const express = require("express");
const morgan = require("morgan");
const app = express();
const fs = require("fs-extra");
const { toBuffer } = require("qrcode");
const JSZip = require("jszip");
const file = require("fs");
const path = require("path");
const zip = new JSZip();
const render = require("./render");
const NodeCache = require("node-cache");
const msgRetryCounterCache = new NodeCache();
const bodyParser = require("body-parser");
const {
  DisconnectReason,
  makeCacheableSignalKeyStore,
  delay,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  default: makeWASocket,
} = require("@whiskeysockets/baileys");
const pino = require("pino");

const PORT = process.env.PORT || 3030;
process.on("unhandledRejection", (err) => console.error(err));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(morgan("dev"));

app.get("/", async (req, res) => {
  res.sendFile(__dirname + "/html/home.html");
});

app.get("/qr", async (req, res) => {
  res.sendFile(__dirname + "/html/qr.html");
});

app.get("/pairing-code", async (req, res) => {
  res.sendFile(__dirname + "/html/phonenum.html");
});

app.get("/pcode/:phone", async (req, res) => {
  const { Boom } = require("@hapi/boom");
  const Pino = require("pino");
  const NodeCache = require("node-cache");
  const code =
    (Math.random() + 1).toString(36).substring(7) +
    (Math.random() + 1).toString(36).substring(2);
  const words = code.split("");
  const ress = words[Math.floor(words.length / 2)];
  const c = code.split(ress).join(ress + "_XASENA_");

  async function start() {
    const { state, saveCreds } = await useMultiFileAuthState(`session/` + c);
    const msgRetryCounterCache = new NodeCache();

    const session = makeWASocket({
      logger: Pino({ level: "fatal" }).child({ level: "fatal" }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          Pino({ level: "fatal" }).child({ level: "fatal" })
        ),
      },
      browser: ["Chrome (Linux)", "", ""],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      msgRetryCounterCache,
    });

    const phoneNumber = req.params.phone.trim();
    console.log(phoneNumber);
    setTimeout(async () => {
      let code = await session.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(code);
      res.send({ "pairing-code": code });
    }, 3000);
    session.ev.on("connection.update", async (update) => {
      const { lastDisconnect, connection } = update;

      if (connection === "open") {
        const str = render(c);
        file.writeFileSync(__dirname + "/html/session.html", str);
        app.get("/session", async (req, res) => {
          res.sendFile(__dirname + "/html/session.html");
        });

        await delay(1000 * 10);

        await session.sendMessage(session.user.id, {
          text: `${c}`,
        });

        await session.sendMessage(session.user.id, {
          text: `\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`,
        });

        const files = fs.readdirSync("./session/" + c);
        for (const file of files) {
          const data = fs.readFileSync("./session/" + c + "/" + file);
          zip.file(file, data);
        }

        zip
          .generateNodeStream({ type: "nodebuffer", streamFiles: true })
          .pipe(file.createWriteStream(`./session/${c}.zip`))
          .on("finish", async function () {
            await session.sendMessage(session.user.id, {
              document: {
                url: `./session/${c}.zip`,
              },
              fileName: "session.zip",
              mimetype: "application/zip",
            });
            process.send("reset");
          });
      }

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;

        switch (reason) {
          case DisconnectReason.badSession:
          case DisconnectReason.timedOut:
            process.send("reset");
            break;

          case DisconnectReason.connectionClosed:
          case DisconnectReason.connectionLost:
          case DisconnectReason.restartRequired:
            await start();
            break;

          case DisconnectReason.connectionReplaced:
          case DisconnectReason.loggedOut:
          case DisconnectReason.multideviceMismatch:
            process.exit(1);
            break;

          default:
            console.log(reason);
            process.send("reset");
            break;
        }
      }
    });

    session.ev.on("creds.update", saveCreds);

    return session;
  }

  start();
});

app.get("/qrcode", (req, res) => {
  console.log(req.params);
  const code =
    (Math.random() + 1).toString(36).substring(7) +
    (Math.random() + 1).toString(36).substring(2);
  const words = code.split("");
  const ress = words[Math.floor(words.length / 2)];
  const c = code.split(ress).join(ress + "_XASENA_");

  async function XAsena() {
    try {
      const { version } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useMultiFileAuthState(
        `./session/` + c
      );
      const session = makeWASocket({
        logger: pino({
          level: "silent",
        }),
        printQRInTerminal: false,
        msgRetryCounterCache,
        browser: Browsers.macOS("Desktop"),
        auth: state,
        version,
      });

      session.ev.on("connection.update", async (s) => {
        if (s.qr) {
          res.end(await toBuffer(s.qr));
        }

        const { connection, lastDisconnect } = s;

        if (connection == "open") {
          const str = render(c);
          file.writeFileSync(__dirname + "/html/session.html", str);
          app.get("/session", async (req, res) => {
            res.sendFile(__dirname + "/html/session.html");
          });

          await delay(1000 * 10);

          await session.sendMessage(session.user.id, {
            text: `${c}`,
          });

          await session.sendMessage(session.user.id, {
            text: `\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*`,
          });

          const files = fs.readdirSync("./session/" + c);
          for (const file of files) {
            const data = fs.readFileSync("./session/" + c + "/" + file);
            zip.file(file, data);
          }

          zip
            .generateNodeStream({ type: "nodebuffer", streamFiles: true })
            .pipe(file.createWriteStream(`./session/${c}.zip`))
            .on("finish", async function () {
              await session.sendMessage(session.user.id, {
                document: {
                  url: `./session/${c}.zip`,
                },
                fileName: "session.zip",
                mimetype: "application/zip",
              });
              process.send("reset");
            });
        }

        if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode != 401
        ) {
          XAsena();
        }
      });

      session.ev.on("creds.update", saveCreds);
      await delay(3000 * 10);
      session.ev.on("messages.upsert", () => {});
    } catch (err) {
      console.log(
        err + "Unknown Error Occured Please report to Owner and Stay tuned"
      );
    }
  }

  XAsena();
});

app.post('/fetch', (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID not provided in the request body' });
  }
  const sessionFolderPath = path.join(__dirname, '/session');
  const zipFilePath = path.join(sessionFolderPath, `${id}.zip`);

  fs.access(zipFilePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(err);
      return res.status(404).json({ error: 'Zip file not found' });
    }
    fs.readFile(zipFilePath, (readErr, data) => {
      if (readErr) {
        console.log(readErr);
        return res.status(500).json({ error: 'Error reading the zip file' });
      }
      res.status(200).send(data);
    });
  });
});

app.listen(PORT, () => console.log("App listened on port", PORT));
