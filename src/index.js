const fs = require("fs");
const path = require("path");
const Branch = require("./Branch");
const Customer = require("./Customer");
const MONOTONIC_WRITES_INPUT_FILE_PATH = path.join(
  __dirname,
  "../input.monotonic_writes.json"
);
const MONOTONIC_WRITES_OUTPUT_FILE_PATH = path.join(
  __dirname,
  "../output.monotonic_writes.json"
);
const READ_WRITES_INPUT_FILE_PATH = path.join(
  __dirname,
  "../input.read_writes.json"
);
const READ_WRITES_OUTPUT_FILE_PATH = path.join(
  __dirname,
  "../output.read_writes.json"
);
const BASE_PORT = process.env.BASE_PORT || 5000;

main(MONOTONIC_WRITES_INPUT_FILE_PATH, MONOTONIC_WRITES_OUTPUT_FILE_PATH)
  .then(() => {
    main(READ_WRITES_INPUT_FILE_PATH, READ_WRITES_OUTPUT_FILE_PATH);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function main(INPUT_FILE_PATH, OUTPUT_FILE_PATH) {
  // Remove the content of the output.txt file
  emptyOutputContent(OUTPUT_FILE_PATH);

  // parse the input json
  const input = JSON.parse(fs.readFileSync(INPUT_FILE_PATH, "utf8"));

  // filter out and initialize the branches
  const branches = input.filter((entity) => entity.type === "branch");

  // initialize the branches
  const branchItems = await initializeBranches(branches);

  // filter out and process the customers
  const customers = input.filter((entity) => entity.type === "customer");

  // process customer events
  const customerItems = await processCustomers(customers);

  writeJSONFiles(branchItems, customerItems, OUTPUT_FILE_PATH);

  // shutdown the servers
  await shutdownServers();
}

async function shutdownServers() {
  for (const server of Branch.servers) {
    await new Promise((resolve, reject) => {
      server.tryShutdown((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

function emptyOutputContent(OUTPUT_FILE_PATH) {
  try {
    fs.writeFileSync(OUTPUT_FILE_PATH, "", "utf8");
    console.log("File content removed successfully!");
  } catch (err) {
    console.error("Error writing to the file:", err);
  }
}

function sleep(ms) {
  // add ms millisecond timeout before promise resolution
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJSONFiles(branchItems, customerItems, OUTPUT_FILE_PATH) {
  console.log("Branches:", branchItems);
  console.log("Customers:", customerItems);
  fs.writeFileSync(
    OUTPUT_FILE_PATH,
    JSON.stringify(
      customerItems.map(({ id, balance }) => ({ id, balance })),
      null,
      2
    ),
    "utf8"
  );
}

async function initializeBranches(branches) {
  const branchItems = [];
  for (const branchData of branches) {
    const branch = new Branch(branchData.id, branchData.balance);
    branchItems.push(branch);
    branch.startServer(BASE_PORT + branchData.id);
    await sleep(50);
  }
  return branchItems;
}

async function processCustomers(customers) {
  const customerItems = [];
  for (const customerData of customers) {
    const customer = new Customer(customerData.id);
    customerItems.push(customer);
    const customerEvents = customerData.events.map((event) => ({
      ...event,
      branchId: event.dest,
    }));
    await customer.executeEvents(customerEvents);
  }
  return customerItems;
}
