// Need to use default import, per https://github.com/netlify/netlify-lambda#debugging
const fetch = require("node-fetch").default;
const nodemailer = require("nodemailer");
const querystring = require("querystring");

const CAPTCHA_API_ENDPOINT = "https://www.google.com/recaptcha/api/siteverify";

const failResponse = {
  statusCode: 500,
  body: "Something went wrong!",
};

const sendEmail = async (msg) => {
  let response;
  let transporter = nodemailer.createTransport({
    host: "premium61.web-hosting.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SEND_EMAIL,
      pass: process.env.SEND_PASSWORD,
    },
  });
  try {
    response = await transporter.sendMail(msg);
    return {
      statusCode: 200,
      body: "Contact form submitted!",
    };
  } catch (err) {
    return { ...failResponse, body: "Failed to send email" + err };
  }
};

// eslint-disable-next-line no-unused-vars
exports.handler = async (event, _context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
      headers: { Allow: "POST" },
    };
  }

  const { RECAPTCHA_SITE_SECRET, UNICS_EMAIL, UNICS_GAMEDEV_EMAIL } =
    process.env;

  // Parse the request body
  let body = {};
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    body = querystring.parse(event.body);
  }
  const { email, name, message, "g-recaptcha-response": captcha, to } = body;
  // Verify the 'to'
  let toEmail;
  if (to === "unics:core") {
    toEmail = UNICS_EMAIL;
  } else if (to === "unics:game-dev") {
    toEmail = UNICS_GAMEDEV_EMAIL;
  } else {
    return { statusCode: 400, body: "Invalid UniCS subteam selection" };
  }
  // Verify the captcha
  let response;
  try {
    response = await fetch(CAPTCHA_API_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${RECAPTCHA_SITE_SECRET}&response=${captcha}`,
    });
  } catch (err) {
    return { ...failResponse, body: "Failed to validate captcha" };
  }
  let a = await response.json();
  if (!a.success) {
    return { ...failResponse, body: "Failed to validate captcha" };
  }

  // After recaptcha verification, send the email
  const msg = {
    to: toEmail,
    from: process.env.SEND_EMAIL,
    subject: `${name}: ${email}`,
    html: message,
  };
  return await sendEmail(msg);
};
