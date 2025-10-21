import Razorpay from "razorpay";

export async function POST(req) {
  try {
    const { amount, currency = "INR", receipt } = await req.json();

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: amount * 100, // amount in paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return Response.json({ success: true, order });
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
