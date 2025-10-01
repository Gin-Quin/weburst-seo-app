import { $ } from "bun"

console.log("Sending the build...")

await $`rsync -avz --delete -e "ssh -i ~/.ssh/weburst" ./build/ weburst:/root/app/`
await $`rsync -avz -e "ssh -i ~/.ssh/weburst" .env.prod weburst:/root/app/.env`

console.log("Restarting service...")

await $`ssh weburst "systemctl restart my-bun-app"`

console.log("🚀 Deployment completed successfully!")
