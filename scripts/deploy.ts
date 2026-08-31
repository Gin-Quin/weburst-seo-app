import { $ } from "bun"

const bunVersion = "1.4.0"

const deployedBunVersion = (await $`ssh weburst "/root/.bun/bin/bun --version"`.text()).trim()
if (deployedBunVersion !== bunVersion) {
	console.log(`Installing Bun ${bunVersion} (currently ${deployedBunVersion})...`)
	await $`ssh weburst "curl -fsSL https://bun.com/install | bash -s bun-v${bunVersion}"`
}

console.log("Sending the build...")

await $`rsync -avz --delete -e "ssh -i ~/.ssh/weburst" ./build/ weburst:/root/app/`
await $`rsync -avz -e "ssh -i ~/.ssh/weburst" .env.prod weburst:/root/app/.env`

console.log("Restarting service...")

await $`ssh weburst "systemctl restart my-bun-app"`

console.log("🚀 Deployment completed successfully!")
