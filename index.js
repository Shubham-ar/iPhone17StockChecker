const axios = require("axios");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

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
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    );
    // Visiting the home page to get cookies/session
    const familyPageUrl =
      "https://www.apple.com/ca/shop/buy-iphone/iphone-17-pro";
    await page.goto(familyPageUrl, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // Visiting the specific product page to get more accurate cookies so as to avoid bot detection
    const productDetailUrl =
      "https://www.apple.com/ca/shop/buy-iphone/iphone-17-pro/6.9-inch-display-256gb-silver";
    await page.goto(productDetailUrl, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await page.setExtraHTTPHeaders({
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      referer: productDetailUrl,
      origin: "https://www.apple.com",
      "sec-ch-ua":
        '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-aos-ui-fetch-call-1": "7ewm6hxa5g-mg4h679u",
    });

    let json = null;
    page.on("response", async (response) => {
      if (response.url().includes("/fulfillment-messages")) {
        try {
          const buffer = await response.buffer();
          const text = buffer.toString();
          json = JSON.parse(text);
        } catch (e) {
          // ignore
        }
      }
    });

    await page.goto(APPLE_API_URL, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await browser.close();
    return json;
  } catch (error) {
    console.error("Error fetching stock info (puppeteer):", error.message);
    console.error(error);
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
    return part && part.pickupDisplay === "unavailable";
  });
}

async function sendEmail(stores) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const storeDetails = stores
    .map(
      (store, idx) => `Store #${idx + 1}:
- Name: ${store.storeName}
- Address: ${store.address.address}${
        store.address.address2 ? ", " + store.address.address2 : ""
      }, ${store.city}, ${store.state}, ${store.address.postalCode}
- Phone: ${store.phoneNumber}
- Store Email: ${store.storeEmail}
- Reservation Link: ${store.reservationUrl}
- Store Image: ${store.storeImageUrl}
- Distance: ${store.storeDistanceWithUnit || store.storedistance + " km"}
`
    )
    .join("\n---------------------\n");

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_TO,
    subject: `iPhone 17 Pro Max 256GB in stock at ${stores.length} store(s)`,
    text: `The iPhone 17 Pro Max 256GB is available for pickup at the following store(s):\n\n${storeDetails}\n\nCheck and reserve here: https://www.apple.com/ca/shop/buy-iphone/iphone-17-pro\n\nThis is an automated notification.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      `Email sent for stores: ${stores
        .map((s) => s.storeName)
        .join(", ")} to ${EMAIL_TO}`
    );
  } catch (err) {
    console.error(
      `Failed to send email for stores: ${stores
        .map((s) => s.storeName)
        .join(", ")}`
    );
    console.error(err);
  }
}

async function main() {
  if (!ENABLE_CHECK) {
    console.log("Stock checking is disabled by ENABLE_CHECK flag.");
    return;
  }
  const data = await fetchStock();
  if (!data) {
    console.log("No data returned from fetchStock.");
    return;
  }
  console.log("Fetched data:", JSON.stringify(data, null, 2));
  const availableStores = parseStock(data);
  console.log(
    "Available stores:",
    availableStores.map((s) => s.storeName)
  );
  if (availableStores.length > 0) {
    await sendEmail(availableStores);
  } else {
    console.log("No stock found.");
  }
}

main();
