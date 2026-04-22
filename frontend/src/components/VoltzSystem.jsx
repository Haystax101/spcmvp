import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Zap, Plus, X, Check, ArrowRight, CreditCard, Sparkles } from 'lucide-react';
import { functions } from '../lib/appwrite';

const STRIPE_GATEWAY_ID = 'stripeGateway';

export function VoltzWallet({ balance, onBuyMore }) {
  return (
    <div className="flex items-center gap-3 bg-white/90 border border-border-light rounded-full pl-3 pr-1 py-1 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <Zap size={14} className="text-accent fill-accent" />
        <span className="font-playfair text-sm font-semibold tracking-tight">{balance}</span>
        <span className="text-[10px] text-text3 uppercase tracking-tighter font-bold">Voltz</span>
      </div>
      <button 
        onClick={onBuyMore}
        className="w-7 h-7 rounded-full bg-text text-white flex items-center justify-center hover:bg-black transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function VoltzPurchaseModal({ open, onClose, userId, currentBalance }) {
  const [loading, setLoading] = useState(false);
  const [selectedPack, setSelectedPack] = useState('pro');
  const [topupQty, setTopupQty] = useState(1);

  const packages = [
    {
      id: 'topup',
      name: 'Voltz Top-up',
      amount: '50 Voltz',
      price: '£1.00',
      description: 'Quick top-up for a few AI drafts or a minor boost.',
      icon: <Zap size={20} className="text-accent" />,
      tag: null
    },
    {
      id: 'pro',
      name: 'Pro Subscription',
      amount: '500 Voltz/mo',
      price: '£5.00/mo',
      description: 'Perfect for power users. Advanced discovery and unlimited potential.',
      icon: <Sparkles size={20} className="text-accent" />,
      tag: 'Best Value'
    }
  ];

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const response = await functions.createExecution(
        STRIPE_GATEWAY_ID,
        JSON.stringify({
          action: 'create_checkout_session',
          userId,
          package: selectedPack,
          quantity: selectedPack === 'topup' ? topupQty : 1,
          successUrl: window.location.origin + '?payment=success',
          cancelUrl: window.location.origin + '?payment=cancelled'
        }),
        false // Explicitly run synchronously
      );

      if (!response || !response.responseBody) {
        console.error("Empty execution response:", response);
        throw new Error("Payment server didn't respond correctly.");
      }

      let data;
      try {
        data = JSON.parse(response.responseBody);
      } catch {
        console.error("Raw response error:", response.responseBody);
        throw new Error("Invalid response format from payment server.");
      }

      if (data.url) {
        // Store session ID so App.jsx can verify on return from Stripe
        if (data.session_id) localStorage.setItem('sc_pending_stripe_session', data.session_id);
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (err) {
      console.error("Purchase error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <Motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <Motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/20"
          >
            <div className="bg-text p-8 text-white relative">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                  <Zap size={20} className="text-accent fill-accent" />
                </div>
                <h2 className="font-playfair text-3xl font-light">Voltz Wallet</h2>
              </div>
              <p className="text-white/60 text-sm font-light leading-relaxed max-w-xs">
                Fuel your discovery. Use Voltz for premium features, AI drafts, and visibility boosts.
              </p>
              
              <div className="mt-8 flex items-baseline gap-2">
                <span className="text-4xl font-playfair font-light">{currentBalance}</span>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Current Balance</span>
              </div>
            </div>

            <div className="p-8">
              <div className="grid gap-4 mb-8">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedPack(pkg.id);
                      }
                    }}
                    onClick={() => setSelectedPack(pkg.id)}
                    className={`text-left p-6 rounded-2xl border transition-all duration-300 relative group cursor-pointer ${
                      selectedPack === pkg.id 
                        ? 'border-text bg-bg shadow-lg scale-[1.02]' 
                        : 'border-border-light hover:border-text/30 bg-white'
                    }`}
                  >
                    {pkg.tag && (
                      <span className="absolute top-0 right-6 -translate-y-1/2 bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                        {pkg.tag}
                      </span>
                    )}
                    
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          selectedPack === pkg.id ? 'bg-text text-white' : 'bg-bg text-text3'
                        }`}>
                          {pkg.icon}
                        </div>
                        <div>
                          <h3 className="font-playfair text-lg font-semibold">{pkg.name}</h3>
                          <p className="text-accent text-sm font-semibold">
                            {pkg.id === 'topup' ? `${50 * topupQty} Voltz` : pkg.amount}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-playfair font-light">
                          {pkg.id === 'topup' ? `£${(1 * topupQty).toFixed(2)}` : pkg.price}
                        </div>
                        {selectedPack === pkg.id && (
                          <Motion.div 
                            layoutId="check"
                            className="text-text mt-1 flex justify-end"
                          >
                            <Check size={16} />
                          </Motion.div>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed transition-colors mb-4 ${
                      selectedPack === pkg.id ? 'text-text2' : 'text-text3'
                    }`}>
                      {pkg.description}
                    </p>

                    {pkg.id === 'topup' && selectedPack === 'topup' && (
                      <Motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center gap-4 bg-white/50 p-3 rounded-xl border border-border-light"
                      >
                        <span className="text-xs font-semibold text-text3 uppercase tracking-wider">Quantity</span>
                        <div className="flex items-center gap-4 ml-auto">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setTopupQty(Math.max(1, topupQty - 1)) }}
                            className="w-8 h-8 rounded-lg bg-white border border-border-light flex items-center justify-center hover:border-text transition-colors"
                          >
                            -
                          </button>
                          <span className="font-playfair text-lg font-semibold w-6 text-center">{topupQty}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setTopupQty(topupQty + 1) }}
                            className="w-8 h-8 rounded-lg bg-white border border-border-light flex items-center justify-center hover:border-text transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </Motion.div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handlePurchase}
                disabled={loading}
                className="w-full bg-text text-white py-4 rounded-2xl text-sm font-semibold tracking-wider flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard size={18} />
                    Secure Checkout
                    <ArrowRight size={18} className="ml-1" />
                  </>
                )}
              </button>
              
              <p className="text-[10px] text-center text-text3 uppercase tracking-widest mt-6 font-medium">
                Payments secured by Stripe · Instant Crediting
              </p>
            </div>
          </Motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
