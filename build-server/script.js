const path = require("node:path")
const { exec } = require("node:child_process")
const fs = require("node:fs")
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const mimeTypes = require("mime-types")
const Redis = require("ioredis")

const publisher = new Redis("redis://username:password@localhost:6379")

const s3Client = new S3Client({
    region: "ap-south-1",
    credentials: {
        accessKeyId: "",
        secretAccessKey: "",
    },
})

const PROJECT_ID = process.env.PROJECT_ID

const publishLog = (log) => {
    publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify(log))
}

async function init() {
    console.log("Executing script.js")
    publishLog("Starting build...")

    const sourceDir = path.join(__dirname, "source")

    const process = exec(`cd ${sourceDir} && npm install && npm run build`,
    )

    process.stdout.on("data", function(data) {
        console.info(data.toString())
        publishLog(data.toString())
    })

    process.stdout.on("error", function(data) {
        console.error("Error", data.toString())
        publishLog(`Error: ${data.toString()}`)
    })

    process.on("close", async function() {
        console.log("Build completed")
        publishLog("Build completed")

        const outputDir = path.join(__dirnamem, "source", "dist")
        const outputDirContents = fs.readdirSync(outputDir, {
            recursive: true,
        })

        publishLog("Uploading...")
        for (const file of outputDirContents) {
            const filePath = path.join(outputDir, file)

            if (fs.lstatSync(filePath).isDirectory()) {
                continue
            }

            console.info("uploading", filePath)
            publishLog(`uploading ${file}`)

            const command = new PutObjectCommand({
                Bucket: "vercel-clone",
                Key:

                    `__sources/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mimeTypes.lookup(filePath),
            })

            await s3Client.send(command)

            console.info("uploaded", filePath)
            publishLog(`uploaded ${file}`)
        }

        console.log("Done...")
        publishLog("Done...")
    })
}

init().then()
