export const batchStreamAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_vault",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createBatch",
    "inputs": [
      {
        "name": "entries",
        "type": "tuple[]",
        "internalType": "struct BatchStream.BatchEntry[]",
        "components": [
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "totalAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "endTime",
            "type": "uint40",
            "internalType": "uint40"
          },
          {
            "name": "cancelable",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "streamIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "vault",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IStreamVault"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BatchCreated",
    "inputs": [
      {
        "name": "business",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "streamIds",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EmptyBatch",
    "inputs": []
  }
] as const;
