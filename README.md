## PARACHAIN TRANSACTIONS MONITORING TOOL

This tools monitors the flow of transactions

Copy `.env.example` into `.env`

Set env variables
code```
# Parachain connection URL
PARACHAIN_URL=

# Address of the user to be funded
USER_ADDRESS=

# SURI of the address that funds the accounts
FUNDER_PRIVATE_KEY=

# Initial amount to be transferred for each transaction
INITIAL_TRANSFER_AMOUNT=

# Total time (in milliseconds) for which the service should run
SERVICE_RUN_TIME=

# Maximum number of transactions to be generated during the service run time
MAX_TRANSACTIONS=

# Number of transactions to be batched and sent together in one block
TRANSACTIONS_PER_BLOCK=

RECIPIENT_ADDRESS=

USER_PRIVATE_KEY=
```

After all this is done:

`npm i` to install depentencies

`node index.js` run the script

`node index.js --no-funds` if you don't want to fund the user account and just proceed to sending transactions

`node index.js --monitor-only` to not generate transactions but to only monitor the flow of the transactions on the parachain