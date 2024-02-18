const path = require("node:path")
const { exec } = require("node:child_process")
const fs = require("node:fs")
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const mimeTypes = require("mime-types")

const s3Client = new S3Client({
    region: "ap-south-1",
    credentials: {
        accessKeyId: "",
        secretAccessKey: "",
    },
})

const PROJECT_ID = process.env.PROJECT_ID

async function init() {
    console.log("Executing script.js")
    const sourceDir = path.join(__dirname, "source")

    const process = exec(`cd ${sourceDir} && npm install && npm run build`)

    process.stdout.on("data", function(data) {
        console.info(data.toString())
    })

    process.stdout.on("error", function(data) {
        console.error("Error", data.toString())
    })

    process.on("close", async function() {
        console.log("Build completed")

        const outputDir = path.join(__dirnamem, "source", "dist")
        const outputDirContents = fs.readdirSync(outputDir, {
            recursive: true,
        })

        for (const file of outputDirContents) {
            const filePath = path.join(outputDir, file)

            if (fs.lstatSync(filePath).isDirectory()) {
                continue
            }

            console.info("uploading", filePath)

            const command = new PutObjectCommand({
                Bucket: "vercel-clone",
                Key: `__sources/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mimeTypes.lookup(filePath),
            })

            await s3Client.send(command)

            console.info("uploaded", filePath)
        }

        console.log("Done...")
    })
}
