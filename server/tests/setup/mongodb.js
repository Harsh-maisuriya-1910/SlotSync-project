import mongoose from "mongoose";
import pkg from "mongodb-memory-server";
const { MongoMemoryReplSet } = pkg;

let replSet = null;

export const connect = async () => {
  if (mongoose.connection.readyState !== 0) {
    return;
  }

  replSet = await MongoMemoryReplSet.create({
    replSet: { storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();

  await mongoose.connect(uri);
};

export const disconnect = async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
};

export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};
