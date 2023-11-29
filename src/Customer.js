const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const fs = require("fs");
const BRANCH_TO_BRANCH_PROTO_PATH = path.join(
  __dirname,
  "./protos/branch_to_branch.proto"
);
const CUSTOMER_TO_BRANCH_PROTO_PATH = path.join(
  __dirname,
  "./protos/customer_to_branch.proto"
);
const BRANCH_TO_BRANCH_PACKAGE_DEFINITION = protoLoader.loadSync(
  BRANCH_TO_BRANCH_PROTO_PATH
);
const CUSTOMER_TO_BRANCH_PACKAGE_DEFINITION = protoLoader.loadSync(
  CUSTOMER_TO_BRANCH_PROTO_PATH
);

const customerToBranchPackage = grpc.loadPackageDefinition(
  CUSTOMER_TO_BRANCH_PACKAGE_DEFINITION
).customertobranch;

const BASE_PORT = process.env.BASE_PORT || 5000;

class Customer {
  static stubs = new Map();
  constructor(id) {
    this.id = id;
    this.recv = [];
    this.balance = 0;
  }

  createStub(branchId) {
    if (Customer.stubs.has(branchId)) {
      return Customer.stubs.get(branchId);
    } else {
      const stub = new customerToBranchPackage.CustomerToBranch(
        `localhost:${BASE_PORT + branchId}`,
        grpc.credentials.createInsecure()
      );
      Customer.stubs.set(branchId, stub);
      return stub;
    }
  }

  async executeEvents(events = []) {
    for (const event of events) {
      const branchId = event.branchId;
      try {
        let res;
        switch (event.interface) {
          case "deposit":
            res = await this.deposit(branchId, event.money);
            this.recv.push({
              interface: "deposit",
              result: res.success ? "success" : "failure",
            });
            break;
          case "withdraw":
            res = await this.withdraw(branchId, event.money);
            this.recv.push({
              interface: "withdraw",
              result: res.success ? "success" : "failure",
            });
            break;
          case "query":
            res = await this.query(branchId);
            this.recv.push({ interface: "query", balance: res.balance });
            break;
          default:
            console.error(`Unknown event interface: ${event.interface}`);
        }
        this.balance = res.balance;
      } catch (error) {
        console.error(error);
      }
    }
  }

  deposit(branchId, amount) {
    return new Promise((resolve, reject) => {
      const stub = this.createStub(branchId);
      stub.deposit({ branchId, amount }, (error, response) => {
        if (error) {
          console.error(
            `Deposit error for Customer ${this.id} to Branch ${branchId}: ${error.message}`
          );
          reject(error);
        } else {
          console.log(
            `Customer ${this.id} deposited ${amount} to Branch ${branchId}. New balance: ${response.balance}`
          );
          resolve(response);
        }
      });
    });
  }

  withdraw(branchId, amount) {
    return new Promise((resolve, reject) => {
      const stub = this.createStub(branchId);
      stub.withdraw({ branchId, amount }, (error, response) => {
        if (error) {
          console.error(
            `Withdraw error for Customer ${this.id} to Branch ${branchId}: ${error.message}`
          );
          reject(error);
        } else {
          console.log(
            `Customer ${this.id} withdrew ${amount} from Branch ${branchId}. New balance: ${response.balance}`
          );
          resolve(response);
        }
      });
    });
  }

  query(branchId) {
    return new Promise((resolve, reject) => {
      const stub = this.createStub(branchId);
      stub.query({ branchId }, (error, response) => {
        if (error) {
          console.error(
            `Query error for Customer ${this.id} on Branch ${branchId}: ${error.message}`
          );
          reject(error);
        } else {
          console.log(
            `Customer ${this.id} queried balance on Branch ${branchId}. Balance: ${response.balance}`
          );
          resolve(response);
        }
      });
    });
  }
}

module.exports = Customer;
