const { Sequelize, DataTypes } = require('sequelize');
const Imap = require('node-imap');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: 'dav_transport.db', logging: false });

const EmailAccount = sequelize.define("EmailAccount", {
  id: { type: DataTypes.STRING(50), primaryKey: true },
  email: DataTypes.STRING(100),
  username: DataTypes.STRING(100),
  password: DataTypes.STRING(100),
  host: DataTypes.STRING(100),
  port: { type: DataTypes.INTEGER, defaultValue: 993 },
  use_ssl: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'email_accounts', timestamps: false });

(async () => {
  console.log("Checking Email Accounts...");
  const accounts = await EmailAccount.findAll();
  console.log(`Found ${accounts.length} accounts in DB.`);
  for (const acc of accounts) {
    console.log(`- ${acc.email} (Active: ${acc.is_active}) - Host: ${acc.host}:${acc.port}`);
    if (acc.is_active) {
      console.log(`  Testing IMAP connection for ${acc.email}...`);
      const imap = new Imap({
        user: acc.username,
        password: acc.password,
        host: acc.host,
        port: acc.port,
        tls: acc.use_ssl,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
        connTimeout: 10000
      });
      
      const success = await new Promise((resolve) => {
        imap.once("ready", () => resolve(true));
        imap.once("error", (err) => {
          console.log(`  [ERROR] Connection failed: ${err.message}`);
          resolve(false);
        });
        imap.connect();
      });
      
      if (success) {
        console.log(`  [SUCCESS] Connected to ${acc.email}. Searching for UNSEEN messages...`);
        const numUnseen = await new Promise((resolve) => {
           imap.openBox("INBOX", false, (err, box) => {
             if (err) return resolve('Error opening inbox');
             imap.search(["UNSEEN"], (err, results) => {
               resolve(results ? results.length : 0);
             });
           });
        });
        console.log(`  [RESULT] ${numUnseen} UNSEEN messages found.`);
        imap.end();
      }
    }
  }
})();
