// test_invoice_job.js
require('dotenv').config();
const mongoose = require('mongoose');
const { generateMonthlyInvoicesForAllRooms } = require('./src/services/invoiceService');
const Contract = require('./src/models/Contract');
const Invoice = require('./src/models/Invoice');

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const day = now.getDate();

    console.log(`Testing invoice generation for ${day}/${month}/${year}`);

    // Update at least one contract to have paymentDate = today so we know it will be picked up
    const randomContract = await Contract.findOne({ status: "active" });
    if (randomContract) {
      console.log(`Setting paymentDate of contract ${randomContract._id} to ${day}`);
      await Contract.updateOne({ _id: randomContract._id }, { paymentDate: day });
    } else {
      console.log("No active contracts found to test with.");
      process.exit(1);
    }

    console.log("Running generateMonthlyInvoicesForAllRooms...");
    const results = await generateMonthlyInvoicesForAllRooms(month, year, day);
    console.log("Job Results:", results);

    // Verify invoice was created/updated
    const invoices = await Invoice.find({ 
      contract: randomContract._id,
      month,
      year
    });
    console.log(`Found ${invoices.length} invoice(s) for contract ${randomContract._id}.`);
    if (invoices.length > 0) {
       console.log("Invoice totalAmount:", invoices[0].totalAmount);
    }

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    mongoose.disconnect();
  }
}

runTest();
