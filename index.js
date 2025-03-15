const {
    default: makeLKSocket,
    setMultiFileAuthState,
    DisconnectReason,
    getContentType,
    jidNormalizedUser,
    Browsers,
    jidDecode,
    makeInMemoryStore
} = require('@darkcriminal/baileys')

const pino = require('pino')
const { Boom } = require('@hapi/boom')
const FileType = require('file-type');
const fs = require('fs')

const {
    Queen_Connect,
    Queen_Msg,
    Queen_Data,
    bytesToSize,
    getSizeMedia
} = require('queen-md')

const {
    OWNER,
    PREFIX,
    USER_NAME,
    PASSWORD
} = require("./config")

const express = require("express");
const app = express();
const port = process.env.PORT || 8080;

const store = makeInMemoryStore({
    logger: pino().child({
        level: 'silent',
        stream: 'store'
    })
})

async function QueenWa() {
    const { state, saveCreds } = await setMultiFileAuthState("./session");
    const queen = makeLKSocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        downloadHistory: false,
        syncFullHistory: false,
    });

    queen.ev.on('creds.update', saveCreds);

    queen.ev.on("connection.update", async (update) => { Queen_Connect(queen, QueenWa, update, jidNormalizedUser, Boom, DisconnectReason, USER_NAME, PASSWORD); })

    queen.ev.on("messages.upsert", async (mek) => { Queen_Msg(queen, mek, PREFIX, OWNER, getContentType); });

    queen.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    queen.getFile = async (PATH, save) => {
        let res
        let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
        //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
        let type = await FileType.fromBuffer(data) || {
            mime: 'application/octet-stream',
            ext: '.bin'
        }
        filename = '../lib/src/' + new Date * 1 + '.' + type.ext
        if (data && save) fs.promises.writeFile(filename, data)
        return {
            res,
            filename,
	    size: await getSizeMedia(data),
            ...type,
            data
        }

    }

    queen.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
        let type = await queen.getFile(path, true);
        let { res, data: file, filename: pathFile } = type;
      
        if (res && res.status !== 200 || file.length <= 65536) {
          try {
            throw {
              json: JSON.parse(file.toString())
            };
          } catch (e) {
            if (e.json) throw e.json;
          }
        }
      
        let opt = {
          filename
        };
      
        if (quoted) opt.quoted = quoted;
        if (!type) options.asDocument = true;
      
        let mtype = '',
          mimetype = type.mime,
          convert;
      
        if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker';
        else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image';
        else if (/video/.test(type.mime)) mtype = 'video';
        else if (/audio/.test(type.mime)) {
          convert = await (ptt ? toPTT : toAudio)(file, type.ext);
          file = convert.data;
          pathFile = convert.filename;
          mtype = 'audio';
          mimetype = 'audio/ogg; codecs=opus';
        } else mtype = 'document';
      
        if (options.asDocument) mtype = 'document';
      
        delete options.asSticker;
        delete options.asLocation;
        delete options.asVideo;
        delete options.asDocument;
        delete options.asImage;
      
        let message = { ...options, caption, ptt, [mtype]: { url: pathFile }, mimetype };
        let m;
      
        try {
          m = await queen.sendMessage(jid, message, { ...opt, ...options });
        } catch (e) {
          //console.error(e)
          m = null;
        } finally {
          if (!m) m = await queen.sendMessage(jid, { ...message, [mtype]: file }, { ...opt, ...options });
          file = null;
          return m;
        }
      }

    Queen_Data(store, queen)
}

QueenWa().catch(console.error);

app.get("/", (req, res) => { res.send("Hello World!"); });
app.listen(port, () => console.log(`Queen-MD Server listening on port http://localhost:8000`));
