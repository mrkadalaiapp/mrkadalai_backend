import Razorpay from 'razorpay';
import crypto from 'crypto';

class RazorpayService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Calculate the gross amount customer needs to pay
   * No service charge added - customer pays exactly what they want to recharge
   */
  calculateGrossAmount(walletAmount) {
    // No service charge - customer pays exactly the wallet amount
    const grossAmount = Math.round(walletAmount * 100) / 100; // Round to 2 decimal places
    const serviceCharge = 0; // No service charge
    
    return {
      walletAmount: walletAmount,
      grossAmount: grossAmount,
      serviceCharge: serviceCharge
    };
  }

  /**
   * Create a Razorpay order for wallet recharge
   */
  async createWalletRechargeOrder(walletAmount, customerId, userId) {
    try {
      const { grossAmount, serviceCharge } = this.calculateGrossAmount(walletAmount);
      
      const options = {
        amount: Math.round(grossAmount * 100), // Amount in paise
        currency: 'INR',
        receipt: `wallet_recharge_${customerId}_${Date.now()}`,
        notes: {
          customer_id: customerId,
          user_id: userId,
          wallet_amount: walletAmount,
          service_charge: serviceCharge,
          transaction_type: 'wallet_recharge'
        }
      };

      const razorpayOrder = await this.razorpay.orders.create(options);

      return {
        success: true,
        order: razorpayOrder,
        walletAmount,
        grossAmount,
        serviceCharge
      };
    } catch (error) {
      console.error('Error creating Razorpay wallet recharge order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    try {
      const body = razorpayOrderId + "|" + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac("sha256", this.razorpay.key_secret)
        .update(body.toString())
        .digest("hex");

      return expectedSignature === razorpaySignature;
    } catch (error) {
      console.error('Error verifying payment signature:', error);
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   */
  async fetchPaymentDetails(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        payment
      };
    } catch (error) {
      console.error('Error fetching payment details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process wallet recharge after successful payment verification
   */
  async processWalletRecharge(paymentDetails, customerId) {
    try {
      const { amount, notes } = paymentDetails;
      const walletAmount = parseFloat(notes.wallet_amount);
      const serviceCharge = parseFloat(notes.service_charge);
      const grossAmount = amount / 100; // Convert from paise to rupees

      return {
        walletAmount,
        grossAmount,
        serviceCharge,
        razorpayPaymentId: paymentDetails.id,
        razorpayOrderId: paymentDetails.order_id
      };
    } catch (error) {
      console.error('Error processing wallet recharge:', error);
      throw new Error('Failed to process wallet recharge');
    }
  }

  /**
   * Get service charge breakdown for display
   */
  getServiceChargeBreakdown(walletAmount) {
    const { grossAmount, serviceCharge } = this.calculateGrossAmount(walletAmount);
    
    return {
      walletAmount: walletAmount,
      serviceCharge: serviceCharge,
      totalPayable: grossAmount,
      serviceChargePercentage: 0 // No service charge
    };
  }
}

let razorpayServiceInstance = null;

try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayServiceInstance = new RazorpayService();
  } else {
    console.log('⚠️  Razorpay keys not configured. Payment features disabled.');
  }
} catch (err) {
  console.log('⚠️  Razorpay initialization failed:', err.message);
}

export default razorpayServiceInstance;