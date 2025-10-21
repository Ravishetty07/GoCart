import crypto from "crypto";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderIds } = await req.json();

    // 1️⃣ Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return Response.json({ success: false, message: "Invalid signature" }, { status: 400 });
    }

    // 2️⃣ Mark orders as paid in DB
    await prisma.order.updateMany({
      where: {
        id: { in: orderIds }, // frontend sends array of order IDs
        paymentMethod: "RAZORPAY",
      },
      data: {
        paymentStatus: "PAID",
        isPaid: true,
      },
    });

    // 3️⃣ Optionally clear cart if needed
    // await prisma.user.update({ where: { id: userId }, data: { cart: {} } });

    return Response.json({ success: true, message: "Payment verified and orders updated" });
  } catch (error) {
    console.error("Razorpay verification error:", error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
