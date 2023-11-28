const fs = require("fs");
const path = require("path");
const Branch = require("./Branch");
const Customer = require("./Customer");
const INPUT_FILE_PATH = path.join(__dirname, "../input.json");
const OUTPUT_FILE_PATH = path.join(__dirname, "../output.txt");
const BASE_PORT = process.env.BASE_PORT || 5000;

async function main() {
  // Remove the content of the output.txt file
  emptyOutputContent();

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

  writeJSONFiles(branchItems, customerItems);

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

function emptyOutputContent() {
  try {
    fs.writeFileSync("output.txt", "", "utf8");
    console.log("File content removed successfully!");
  } catch (err) {
    console.error("Error writing to the file:", err);
  }
}

function sleep(ms) {
  // add ms millisecond timeout before promise resolution
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJSONFiles(_, customerItems) {
  customerItems.forEach(({ id, recv }) => {
    fs.appendFileSync(
      OUTPUT_FILE_PATH,
      JSON.stringify({ id, recv }) + "\n",
      "utf8"
    );
  });
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
  const promises = [];
  for (const customerData of customers) {
    const customer = new Customer(customerData.id);
    customer.createStub();
    customerItems.push(customer);
    const customerEvents = customerData.events.map((event) => ({
      ...event,
      branchId: customerData.id,
    }));
    await customer.executeEvents(customerEvents);
  }
  return customerItems;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
