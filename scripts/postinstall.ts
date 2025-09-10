import fs from "node:fs";

if (!fs.existsSync("data")) {
	fs.mkdirSync("data");
}
