const axios = require("axios");
const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.GMAIL_USER || "shubham.jhamb2000@gmail.com";
const EMAIL_PASS = process.env.GMAIL_PASS || "";
const EMAIL_TO = process.env.EMAIL_TO;

const LOCATION = process.env.LOCATION || "M9B 0E4";
const PART_NUMBER = process.env.PART_NUMBER || "MFY84VC/A";
const ENABLE_CHECK = process.env.ENABLE_CHECK !== "false";

const APPLE_API_URL = `https://www.apple.com/ca/shop/fulfillment-messages?fae=true&pl=true&mts.0=regular&parts.0=${PART_NUMBER}&location=${encodeURIComponent(
  LOCATION
)}`;

async function fetchStock() {
  try {
    const response = await axios.get(APPLE_API_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept-Language": "en-CA,en;q=0.9",
        Referer: "https://www.apple.com/ca/shop/buy-iphone/iphone-17-pro",
        Accept: "application/json, text/plain, */*",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching stock info:", error.message);
    return null;
  }
}

function parseStock(data) {
  const stores =
    data.body &&
    data.body.content &&
    data.body.content.pickupMessage &&
    data.body.content.pickupMessage.stores;
  if (!stores) return [];
  return stores.filter((store) => {
    const part =
      store.partsAvailability && store.partsAvailability["MFY84VC/A"];
    return part && part.pickupDisplay === "available";
  });
}

async function sendEmail(store) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_TO,
    subject: `iPhone 17 Pro Max 256GB in stock at ${store.storeName}`,
    text: `The iPhone 17 Pro Max 256GB is available for pickup.\n\nStore Details:\n- Name: ${
      store.storeName
    }\n- Address: ${store.address.address}${
      store.address.address2 ? ", " + store.address.address2 : ""
    }, ${store.city}, ${store.state}, ${store.address.postalCode}\n- Phone: ${
      store.phoneNumber
    }\n- Store Email: ${store.storeEmail}\n- Reservation Link: ${
      store.reservationUrl
    }\n- Store Image: ${store.storeImageUrl}\n- Distance: ${
      store.storeDistanceWithUnit || store.storedistance + " km"
    }\n\nCheck and reserve here: https://www.apple.com/ca/shop/buy-iphone/iphone-17-pro\n\nThis is an automated notification.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent for store: ${store.storeName}`);
  } catch (err) {
    console.error(`Failed to send email for store: ${store.storeName}`);
    console.error(err);
  }
}

async function main() {
  if (!ENABLE_CHECK) {
    console.log("Stock checking is disabled by ENABLE_CHECK flag.");
    return;
  }
  const data = await fetchStock();
  if (!data) return;
  const availableStores = parseStock(data);
  for (const store of availableStores) {
    await sendEmail(store);
  }
  if (availableStores.length === 0) {
    console.log("No stock found.");
  }
}

main();
