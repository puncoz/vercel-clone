"use strict"

const express = require("express")
const { generateSlug } = require("random-word-slugs")
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs")
const Redis = require("ioredis")
const { Server: SocketServer } = require("socket.io")

const app = express()
const PORT = 9000

const subscriber = new Redis("redis://username:password@localhost:6379")

const io = new SocketServer({
    cors: "*",
})

io.on("connection", (socket) => {
    socket.on("subscribe", (channel) => {
        socket.join(channel)
        socket.emit("message", `Joined ${channel}`)
    })
})

const initRedisSubscriptions = () => {
    console.log("Subscribing to logs...")

    subscriber.psubscribe("logs:*")
    subscriber.on("pmessage", (pattern, channel, message) => {
        io.to(channel).emit("message", message)
    })
}

io.listen(9001, () => {
    console.log("Socket server listening on port 9001")
})

const ecsClient = new ECSClient({
    region: "ap-south-1",
    credentials: {
        accessKeyId: "",
        secretAccessKey: "",
    },
})

const config = {
    CLUSTER_ARN: "arn:aws:ecs:ap-south-1:000000000000:cluster/vercel-clone",
    TASK_ARN: "arn:aws:ecs:ap-south-1:000000000000:task-definition/vercel-clone-builder-task",
}

app.post("/project", async (req, res) => {
    const { gitUrl, slug } = req.body
    const projectSlug = slug ?? generateSlug()

    // spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER_ARN,
        taskDefinition: config.TASK_ARN,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: ["subnet-00000000", "subnet-00000001", "subnet-00000002"],
                securityGroups: "sg-00000000",
                assignPublicIp: "ENABLED",
            },
        },
        overrides: {
            containerOverrides: [
                {
                    name: "vercel-clone-builder-image",
                    environment: [
                        {
                            name: "GIT_REPOSITORY",
                            value: gitUrl,
                        },
                        {
                            name: "PROJECT_ID",
                            value: projectSlug,
                        },
                    ],
                },
            ],
        },
    })

    await ecsClient.send(command)

    return res.json({
        status: "queued",
        data: {
            projectSlug,
            url: `http://${projectSlug}.localhost:8000`,
        },
    })
})

app.listen(PORT, () => console.log(`Api server listening on port ${PORT}`))
