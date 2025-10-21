import { PlusIcon, SquarePenIcon, XIcon } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import AddressModal from './AddressModal';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Protect, useAuth, useUser } from '@clerk/nextjs';
import axios from 'axios';
import { fetchCart } from '@/lib/features/cart/cartSlice';

const OrderSummary = ({ totalPrice, items }) => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '$';
  const router = useRouter();
  const addressList = useSelector((state) => state.address.list);

  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // ✅ Load Razorpay checkout script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.querySelector("script[src='https://checkout.razorpay.com/v1/checkout.js']")) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error('Failed to load Razorpay script');
    document.body.appendChild(script);
  }, []);

  const handleCouponCode = async (event) => {
    event.preventDefault();
    try {
      if (!user) return toast('Please login to proceed');
      const token = await getToken();
      const { data } = await axios.post(
        '/api/coupon',
        { code: couponCodeInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCoupon(data.coupon);
      toast.success('Coupon Applied');
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    }
  };

  // ✅ Main order handler
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    try {
      if (!user) return toast('Please login to place an order');
      if (!selectedAddress) return toast('Please select an address');

      const token = await getToken();
      const orderData = {
        addressId: selectedAddress.id,
        items,
        paymentMethod,
      };
      if (coupon) orderData.couponCode = coupon.code;

      // Step 1: create order in your own DB
      const { data } = await axios.post('/api/orders', orderData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Step 2: handle payment methods
      if (paymentMethod === 'STRIPE') {
        window.location.href = data.session.url;
      } else if (paymentMethod === 'RAZORPAY') {
        if (!scriptLoaded) return toast.error('Razorpay SDK not loaded yet');
        const amountToPay = totalPrice; // in rupees; backend multiplies by 100

        const orderRes = await axios.post('/api/razorpay/create-order', {
          amount: amountToPay,
          currency: 'INR',
          receipt: data.order?.id || `rcpt_${Date.now()}`,
        });
        const { order } = orderRes.data;

        if (!order) {
          toast.error('Failed to create Razorpay order');
          return;
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          name: 'Order Payment',
          description: 'Payment for your order',
          order_id: order.id,
          handler: async function (response) {
            try {
              const verifyRes = await axios.post('/api/razorpay/verify-payment', response);
              if (verifyRes.data.success) {
                toast.success('Payment successful!');
                router.push('/orders');
                dispatch(fetchCart({ getToken }));
              } else {
                toast.error('Payment verification failed.');
              }
            } catch (err) {
              console.error(err);
              toast.error('Error verifying payment');
            }
          },
          prefill: {
            name: user?.fullName || '',
            email: user?.primaryEmailAddress?.emailAddress || '',
          },
          theme: { color: '#3399cc' },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.success(data.message);
        router.push('/orders');
        dispatch(fetchCart({ getToken }));
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    }
  };

  return (
    <div className="w-full max-w-lg lg:max-w-[340px] bg-slate-50/30 border border-slate-200 text-slate-500 text-sm rounded-xl p-7">
      <h2 className="text-xl font-medium text-slate-600">Request Summary</h2>
      <p className="text-slate-400 text-xs my-4">Payment Method</p>

      {/* COD */}
      <div className="flex gap-2 items-center">
        <input
          type="radio"
          id="COD"
          name="payment"
          onChange={() => setPaymentMethod('COD')}
          checked={paymentMethod === 'COD'}
          className="accent-gray-500"
        />
        <label htmlFor="COD" className="cursor-pointer">
          COD
        </label>
      </div>

      {/* Stripe */}
      {/* <div className="flex gap-2 items-center mt-1">
        <input
          type="radio"
          id="STRIPE"
          name="payment"
          onChange={() => setPaymentMethod('STRIPE')}
          checked={paymentMethod === 'STRIPE'}
          className="accent-gray-500"
        />
        <label htmlFor="STRIPE" className="cursor-pointer">
          Stripe Payment
        </label>
      </div> */}

      {/* Razorpay */}
      <div className="flex gap-2 items-center mt-1">
        <input
          type="radio"
          id="RAZORPAY"
          name="payment"
          onChange={() => setPaymentMethod('RAZORPAY')}
          checked={paymentMethod === 'RAZORPAY'}
          className="accent-gray-500"
        />
        <label htmlFor="RAZORPAY" className="cursor-pointer">
          Razorpay Payment
        </label>
      </div>

      {/* Rest of your UI (unchanged) */}
      <div className="my-4 py-4 border-y border-slate-200 text-slate-400">
        <p>Delivery Location</p>
        {selectedAddress ? (
          <div className="flex gap-2 items-center">
            <p>
              {selectedAddress.name}, {selectedAddress.city}, {selectedAddress.state},{' '}
              {selectedAddress.zip}
            </p>
            <SquarePenIcon
              onClick={() => setSelectedAddress(null)}
              className="cursor-pointer"
              size={18}
            />
          </div>
        ) : (
          <div>
            {addressList.length > 0 && (
              <select
                className="border border-slate-400 p-2 w-full my-3 outline-none rounded"
                onChange={(e) => setSelectedAddress(addressList[e.target.value])}
              >
                <option value="">Select Address</option>
                {addressList.map((address, index) => (
                  <option key={index} value={index}>
                    {address.name}, {address.city}, {address.state}, {address.zip}
                  </option>
                ))}
              </select>
            )}
            <button
              className="flex items-center gap-1 text-slate-600 mt-1"
              onClick={() => setShowAddressModal(true)}
            >
              Add Address <PlusIcon size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Totals and button (unchanged) */}
      <div className="flex justify-between py-4">
        <p>Total:</p>
        <p className="font-medium text-right">
          <Protect
            plan={'plus'}
            fallback={`${currency}${
              coupon
                ? (totalPrice + 5 - (coupon.discount / 100 * totalPrice)).toFixed(2)
                : (totalPrice + 5).toLocaleString()
            }`}
          >
            {currency}
            {coupon
              ? (totalPrice - (coupon.discount / 100 * totalPrice)).toFixed(2)
              : totalPrice.toLocaleString()}
          </Protect>
        </p>
      </div>
      <button
        onClick={(e) => toast.promise(handlePlaceOrder(e), { loading: 'Placing Order...' })}
        className="w-full bg-slate-700 text-white py-2.5 rounded hover:bg-slate-900 active:scale-95 transition-all"
      >
        Submit for Approval
      </button>

      {showAddressModal && <AddressModal setShowAddressModal={setShowAddressModal} />}
    </div>
  );
};

export default OrderSummary;
