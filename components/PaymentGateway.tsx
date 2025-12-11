
import React, { useEffect, useState } from 'react';

interface PaymentGatewayProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
  isDemo: boolean;
  splits?: {
      storeAmount: number;
      storeUpi: string;
      handlingFee: number;
      adminUpi: string;
      deliveryFee: number;
      driverUpi: string;
  };
}

export const PaymentGateway: React.FC<PaymentGatewayProps> = ({ amount, onSuccess, onCancel, isDemo, splits }) => {
  const [step, setStep] = useState<'CONNECTING' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS'>('CONNECTING');
  
  useEffect(() => {
    // Simulate initial connection
    const timer = setTimeout(() => setStep('CONFIRM'), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handlePay = () => {
    setStep('PROCESSING');
    
    if (isDemo) {
        // DEMO MODE
        setTimeout(() => {
            setStep('SUCCESS');
            setTimeout(onSuccess, 2000);
        }, 3000);
    } else {
        // REAL MODE (Simulating direct UPI Deep Link to Store)
        const upiLink = `upi://pay?pa=${splits?.storeUpi || 'store@upi'}&pn=StoreOwner&am=${amount.toFixed(2)}&cu=INR`;
        window.location.href = upiLink;
    }
  };

  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 z-[100] bg-brand-DEFAULT flex flex-col items-center justify-center text-white animate-fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 animate-bounce">
          <svg className="w-12 h-12 text-brand-DEFAULT" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-black mb-2">Payment Successful!</h2>
        <p className="text-white/80 font-medium text-center max-w-xs">
            Your order has been placed with the store.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-100 flex flex-col animate-fade-in">
      {/* Fake Browser Bar */}
      <div className="bg-gray-800 p-3 flex items-center gap-3 shadow-md">
        <button onClick={onCancel} className="text-gray-400 hover:text-white">✕</button>
        <div className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-xs text-green-400 font-mono flex items-center gap-2">
          <span className="text-gray-400">🔒</span> https://secure-payments.bank-gateway.com
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {step === 'CONNECTING' && (
           <div className="text-center">
             <div className="w-12 h-12 border-4 border-gray-300 border-t-brand rounded-full animate-spin mx-auto mb-4"></div>
             <p className="text-gray-500 font-bold">Connecting to Banking Servers...</p>
           </div>
        )}

        {step === 'CONFIRM' && splits && (
             <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                <div className="bg-slate-900 p-6 text-white text-center">
                    <h3 className="text-xl font-black">Confirm Payment</h3>
                    <p className="text-sm text-slate-400">Paying Store Directly</p>
                </div>
                
                <div className="p-6 space-y-4">
                    {/* Store Payment - SINGLE TOTAL */}
                    <div className="flex justify-between items-center bg-brand-light p-4 rounded-2xl border border-brand-DEFAULT/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm text-brand-DEFAULT">🏪</div>
                            <div>
                                <p className="text-xs font-bold text-brand-dark uppercase">To Store</p>
                                <p className="text-xs text-slate-500 font-mono">{splits.storeUpi}</p>
                            </div>
                        </div>
                        <span className="font-black text-2xl text-slate-900">₹{amount}</span>
                    </div>

                    {splits.deliveryFee > 0 && (
                        <div className="bg-slate-50 px-3 py-2 rounded-xl text-center">
                            <p className="text-[10px] text-slate-500 font-bold">
                                Includes ₹{splits.deliveryFee} delivery fee (Paid to Store)
                            </p>
                        </div>
                    )}
                    
                    {splits.deliveryFee === 0 && (
                        <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex items-center gap-2 justify-center">
                             <span className="text-lg">🎉</span>
                             <p className="text-xs text-emerald-700 font-bold">Free Delivery Applied!</p>
                        </div>
                    )}

                    <button 
                        onClick={handlePay}
                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black active:scale-95 transition-all mt-4"
                    >
                        Pay ₹{amount}
                    </button>
                </div>
             </div>
        )}

        {step === 'PROCESSING' && (
             <div className="text-center bg-white p-8 rounded-[2rem] shadow-xl max-w-xs w-full">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto border-4 border-blue-100 animate-pulse mb-6">
                    💸
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Processing...</h3>
                <p className="text-xs text-slate-500 mb-6">Please approve the request in your UPI App.</p>
                
                <div className="space-y-2">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 animate-[width_2s_ease-in-out_infinite] w-1/2"></div>
                    </div>
                </div>

                {!isDemo && (
                     <button onClick={() => setStep('SUCCESS')} className="mt-6 text-xs font-bold text-slate-400 hover:text-blue-600">
                         Simulate Success (Dev)
                     </button>
                )}
             </div>
        )}
      </div>
    </div>
  );
};
