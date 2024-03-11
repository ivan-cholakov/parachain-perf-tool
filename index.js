const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const PARACHAIN_URL = process.env.PARACHAIN_URL || '';
const USER_ADDRESS = process.env.USER_ADDRESS || '';
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY || '';
const INITIAL_TRANSFER_AMOUNT = parseInt(process.env.INITIAL_TRANSFER_AMOUNT, 10) || 0;
const SERVICE_RUN_TIME = parseInt(process.env.SERVICE_RUN_TIME, 10) || 60000;
const MAX_TRANSACTIONS = parseInt(process.env.MAX_TRANSACTIONS, 10) || 100;
const TRANSACTIONS_PER_BLOCK = parseInt(process.env.TRANSACTIONS_PER_BLOCK, 10) || 10;
const FUNDER_PRIVATE_KEY = process.env.FUNDER_PRIVATE_KEY || '';
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS ||'';

let currentTransactions = 0;
let currentAmount = INITIAL_TRANSFER_AMOUNT;

const GENERATED_TX_LOG_FILE = 'generated_transactions.txt';
const MONITORED_TX_LOG_FILE = 'monitored_transactions.txt';
const FAILED_TX_LOG_FILE = 'failed_transactions.txt';

const logGeneratedTransaction = (message) => {
  console.log(message);
  fs.appendFileSync(GENERATED_TX_LOG_FILE, message + '\n');
};

const logMonitoredTransaction = (message) => {
  console.log("MONITORED", message);
  fs.appendFileSync(MONITORED_TX_LOG_FILE, message + '\n');
};

const logFailedTransaction = (message) => {
    console.log(message);
    fs.appendFileSync(FAILED_TX_LOG_FILE, message + '\n');
};

const formatTransactionLog = (blockNumber, timestamp, from, accountNonce, to, value, txHash = null) => {
    return `------- TRANSACTION LOG -------\n` +
           `Block Number: ${blockNumber}\n` +
           `Timestamp: ${timestamp}\n` +
           `From: ${from} ${accountNonce ? `(Account Nonce: ${accountNonce})`:''}\n` +
           `To: ${to}\n` +
           `Amount: ${value} tokens\n` +
           (txHash ? `Transaction Hash: ${txHash}\n` : '') +
           `---------------------------------\n`;
};

const connectToParachain = async () => {
  const wsProvider = new WsProvider(PARACHAIN_URL);
  const api = await ApiPromise.create({ provider: wsProvider });
  return api;
};

const fundUser = async (api) => {
  const keyring = new Keyring({ type: 'sr25519' });
  const funder = keyring.addFrom(FUNDER_PRIVATE_KEY);

  const txHash = await api.tx.balances.transfer(USER_ADDRESS, currentAmount).signAndSend(funder);
  logTransaction(`Funded user ${USER_ADDRESS} with ${currentAmount} tokens. Transaction Hash: ${txHash}`);
};

let currentNonce;

// const generateTransactions = async (api) => {
//   const keyring = new Keyring({ type: 'sr25519' });
//   const user = keyring.addFromUri(USER_PRIVATE_KEY);

//   if (!currentNonce) {
//     currentNonce = await api.rpc.system.accountNextIndex(USER_ADDRESS);
//   }

//   let count = 0

//   for (let i = 0; i < MAX_TRANSACTIONS; i++) {

//     currentAmount += 1;

//     const txHash = await api.tx.balances.transfer(RECIPIENT_ADDRESS, currentAmount).signAndSend(user, { nonce: currentNonce });

//     const blockHeader = await api.rpc.chain.getHeader();
//     const blockNumber = blockHeader.number.toNumber();
//     const timestampData = await api.query.timestamp.now();
//     const timestamp = timestampData ? new Date(timestampData.toNumber()) : 'N/A';

//     const logMessage = formatTransactionLog(blockNumber, timestamp, USER_ADDRESS, currentNonce, RECIPIENT_ADDRESS, currentAmount, txHash);
//     logGeneratedTransaction(logMessage);



//     currentNonce++;
//     count++;

//     if ((i + 1) % 100 === 0) {
//       await new Promise(resolve => setTimeout(resolve, 5000)); // Pause for 5 seconds
//       // currentNonce = await api.rpc.system.accountNextIndex(USER_ADDRESS); // Refresh the currentNonce
//     }
//   }
// };

const generateTransactions = async (api) => {
  const keyring = new Keyring({ type: 'sr25519' });
  const user = keyring.addFromUri(USER_PRIVATE_KEY);

  if (!currentNonce) {
    currentNonce = await api.rpc.system.accountNextIndex(USER_ADDRESS);
  }

  for (let i = 0; i < MAX_TRANSACTIONS; i++) {
    currentAmount += 1;

    const txHash = await api.tx.balances.transfer(RECIPIENT_ADDRESS, currentAmount).signAndSend(user, { nonce: currentNonce });

    const blockHeader = await api.rpc.chain.getHeader();
    const blockNumber = blockHeader.number.toNumber();
    const timestampData = await api.query.timestamp.now();
    const timestamp = timestampData ? new Date(timestampData.toNumber()) : 'N/A';

    const logMessage = formatTransactionLog(blockNumber, timestamp, USER_ADDRESS, currentNonce, RECIPIENT_ADDRESS, currentAmount, txHash);
    logGeneratedTransaction(logMessage);


    currentNonce++;

    if ((i + 1) % TRANSACTIONS_PER_BLOCK === 0) {
      await new Promise(resolve => setTimeout(resolve, api.consts.timestamp.minimumPeriod * 2));
    }
  }
};


const monitorTransactions = (api) => {
    console.log("Starting transaction monitoring...");
  
    api.query.system.events(async (events) => {
      const blockHeader = await api.rpc.chain.getHeader();
      const blockNumber = blockHeader.number.toNumber();

      const block = await api.rpc.chain.getBlock();
  
      for (const record of events) {
        const { event, phase } = record;
        const timestampData = await api.query.timestamp.now();
        const timestamp = timestampData ? new Date(timestampData.toNumber()) : 'N/A';
  
        if (event.section === "balances" && event.method === "Transfer") {
            const [from, to, value] = event.data;
            if (from.toString() ==='5EHFcagqMUGu47Yx5ZHHY6z5VhMr375U5MmsF1WuFuDFFoix'&&to.toString()==='5H8u2iEfeGqj3R6dSdL1hcfWQ4GWtco1HoFiZJDvrCdapvR7'){
              let txHash = 'N/A';
              if (phase.isApplyExtrinsic) {
                const extrinsicIdx = phase.asApplyExtrinsic.toNumber();
                const extrinsic = block.block.extrinsics[extrinsicIdx];
                txHash = extrinsic?.hash;
              }
  
              const data2 = await api.query.tokenManager.nonces(from);
      
              const logMessage = formatTransactionLog(blockNumber, timestamp, from.toString(), data2.toJSON(), to.toString(), value.toString(), txHash);
              logMonitoredTransaction(logMessage);
            }

            
  
        } else if (event.section === "system" && event.method === "ExtrinsicFailed") {
          const [dispatchError] = event.data;
          let errorMsg;
          if (dispatchError.isModule) {
            try {
              const mod = dispatchError.asModule;
              const error = api.registry.findMetaError(new Uint8Array([mod.index.toNumber(), mod.error.toNumber()]));
              errorMsg = `${error.section}.${error.name}`;
            } catch (err) {
              errorMsg = dispatchError.toString();
            }
          } else {
            errorMsg = dispatchError.toString();
          }
  
          logFailedTransaction(`------- TRANSACTION FAILED -------\n` +
            `Block Number: ${blockNumber}\n` +
            `Timestamp: ${timestamp}\n` +
            `Error: ${errorMsg}\n` +
            `----------------------------------\n`);
        }
      }
    });
  };
const runService = async () => {
    const api = await connectToParachain();
  
    // Check if only monitoring is requested
    if (process.argv.includes('--monitor-only')) {
      console.log("Starting the app in monitoring mode.");
      monitorTransactions(api);
    } else {
      monitorTransactions(api);
      if (!process.argv.includes('--no-fund')) {
        await fundUser(api);  // This line funds the user, but only if --no-fund isn't provided.
      }
      await generateTransactions(api);
  
      setTimeout(() => {
        console.log("Service has completed its run.");
        process.exit(0);
      }, SERVICE_RUN_TIME);
    }
  };
  

runService();
