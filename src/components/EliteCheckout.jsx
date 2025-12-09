import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Smartphone, Globe, ArrowRight, Shield, Zap, Crown, Star } from 'lucide-react';
import axios from 'axios';

// ✅ Imports Stripe
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

// ✅ Initialisation Stripe sécurisée
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// === SOUS-COMPOSANT : Formulaire Carte Bancaire ===
const StripeCardForm = ({ amount, currency, user, onSuccess, onError, isProcessing, setIsProcessing }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    const cardElement = elements.getElement(CardElement);

    try {
      // 1. Création du Token/PaymentMethod côté Stripe
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: user?.fullName || 'Client Elite',
          email: user?.email,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // 2. Envoi au Backend
      const response = await axios.post(
        `${API_URL}/payment/init`, // Assure-toi que cette route gère 'paymentMethodId'
        {
          userId: user._id,
          amount: amount,
          currency: currency,
          paymentMethod: 'card',
          paymentMethodId: paymentMethod.id, // ✅ On envoie le vrai ID Stripe
        },
        {
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        onSuccess(response.data.transactionId);
      } else {
        throw new Error(response.data.error || "Échec du paiement");
      }

    } catch (err) {
      console.error("Erreur Paiement Carte:", err);
      onError(err.message || "Une erreur est survenue");
    } finally {
      setIsProcessing(false);
    }
  };

  // Styles personnalisés pour l'input Stripe (Dark Mode)
  const cardStyle = {
    style: {
      base: {
        color: "#ffffff",
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": { color: "#9ca3af" },
        iconColor: "#a855f7" // Violet
      },
      invalid: {
        color: "#ef4444",
        iconColor: "#ef4444"
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 focus-within:border-purple-500 transition-colors">
        <CardElement options={cardStyle} />
      </div>
      
      <button 
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white shadow-lg shadow-green-900/20"
      >
        {isProcessing ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Traitement sécurisé...
          </>
        ) : (
          <>
            <Shield className="w-5 h-5" />
            Payer par Carte {amount.toLocaleString()} {currency === 'EUR' ? '€' : currency}
          </>
        )}
      </button>
    </form>
  );
};


// === COMPOSANT PRINCIPAL ===
const EliteCheckout = ({ onClose, onSuccess, user }) => {
  const [step, setStep] = useState(1);
  const [selectedCurrency, setSelectedCurrency] = useState('XOF');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState(null); // Utilisé pour l'affichage final si besoin

  const currencies = [
    { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'FCFA', price: 25000 },
    { code: 'XAF', name: 'Franc CFA (BEAC)', symbol: 'FCFA', price: 25000 },
    { code: 'EUR', name: 'Euro', symbol: '€', price: 39 },
    { code: 'USD', name: 'Dollar US', symbol: '$', price: 49 },
    { code: 'MAD', name: 'Dirham Marocain', symbol: 'MAD', price: 450 },
  ];

  const mobileMoneyProviders = [
    { id: 'wave', name: 'Wave', icon: '🌊' },
    { id: 'orange', name: 'Orange Money', icon: '🟠' },
    { id: 'mtn', name: 'MTN Mobile Money', icon: '💛' },
    { id: 'moov', name: 'Moov Money', icon: '🔵' },
  ];

  const eliteFeatures = [
    { icon: <Zap className="w-6 h-6" />, title: 'Analyse Automatique', desc: 'IA analyse vos plans instantanément' },
    { icon: <Crown className="w-6 h-6" />, title: 'Priorité Absolue', desc: 'Réponses ultra-rapides garanties' },
    { icon: <Star className="w-6 h-6" />, title: 'Calculs Illimités', desc: 'Tous types de calculs sans limite' },
    { icon: <Shield className="w-6 h-6" />, title: 'Support Premium', desc: 'Assistance 24/7 par experts' },
    { icon: <Globe className="w-6 h-6" />, title: 'Multi-Projets', desc: 'Gérez 50+ projets simultanément' },
    { icon: <Check className="w-6 h-6" />, title: 'Exports Pro', desc: 'PDF, DWG, IFC professionnels' },
  ];

  const currentPrice = currencies.find(c => c.code === selectedCurrency);

  // Gestion Mobile Money (inchangée mais adaptée à la nouvelle structure)
  const handleMobilePayment = async () => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/payment/init`,
        {
          userId: user._id,
          amount: currentPrice.price,
          currency: selectedCurrency,
          paymentMethod: selectedPaymentMethod,
          phoneNumber: phoneNumber,
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.data.success) throw new Error(response.data.error);

      const txId = response.data.transactionId;
      setTransactionId(txId);

      if (response.data.paymentUrl) {
        window.location.href = response.data.paymentUrl;
        return;
      }

      // Polling statut pour Mobile Money
      const checkInterval = setInterval(async () => {
        try {
            const res = await axios.get(`${API_URL}/payment/status/${txId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.status === 'completed') {
                clearInterval(checkInterval);
                handleSuccess(txId);
            } else if (res.data.status === 'failed') {
                clearInterval(checkInterval);
                alert("Paiement échoué.");
                setIsProcessing(false);
            }
        } catch (e) { console.error(e); }
      }, 3000);

      // Timeout 5 min
      setTimeout(() => clearInterval(checkInterval), 300000);

    } catch (error) {
      console.error('Erreur Mobile Money:', error);
      alert(error.response?.data?.error || 'Erreur paiement');
      setIsProcessing(false);
    }
  };

  const handleSuccess = (txId) => {
    setTransactionId(txId);
    setStep(4);
    if (onSuccess) setTimeout(onSuccess, 2000);
  };

  const handleError = (msg) => {
    alert(msg);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[9999] flex items-center justify-center p-4">
      <div className="relative bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-purple-500/30">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700 transition-all text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Barre de progression */}
        <div className="h-2 bg-gray-800">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="p-8 overflow-y-auto max-h-[calc(90vh-8px)] custom-scrollbar">
          
          {/* ÉTAPE 1: AVANTAGES */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center">
                <div className="inline-block p-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/20">
                  <Crown className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500 mb-2">
                  PASSEZ EN MODE ÉLITE
                </h2>
                <p className="text-gray-400">Débloquez tout le potentiel de VISIONIA</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {eliteFeatures.map((feature, idx) => (
                  <div key={idx} className="p-6 bg-gray-800/50 rounded-xl border border-purple-500/20 hover:border-purple-500/50 transition-all hover:bg-gray-800">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">{feature.title}</h3>
                        <p className="text-sm text-gray-400">{feature.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-xl p-6 border border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Abonnement Mensuel</p>
                    <p className="text-3xl font-black text-white">25 000 FCFA<span className="text-lg text-gray-400">/mois</span></p>
                  </div>
                  <button 
                    onClick={() => setStep(2)}
                    className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 text-white shadow-lg shadow-orange-900/20"
                  >
                    Continuer <ArrowRight className="w-5 h-5" />
                  </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2: DEVISE */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Choisissez votre devise</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {currencies.map((currency) => (
                  <button
                    key={currency.code}
                    onClick={() => setSelectedCurrency(currency.code)}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      selectedCurrency === currency.code
                        ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-white">{currency.symbol}</span>
                      {selectedCurrency === currency.code && <Check className="w-6 h-6 text-purple-400" />}
                    </div>
                    <p className="text-lg font-bold text-white mb-1">{currency.name}</p>
                    <p className="text-2xl font-black text-purple-400">
                      {currency.price.toLocaleString()} {currency.symbol}
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={() => setStep(1)} className="px-6 py-4 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-all">
                  Retour
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2 text-white shadow-lg shadow-purple-900/20"
                >
                  Suivant <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3: PAIEMENT */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Moyen de paiement</h2>
                <div className="mt-4 inline-block px-6 py-3 bg-purple-900/40 rounded-xl border border-purple-500/30">
                  <p className="text-2xl font-bold text-white">
                    {currentPrice.price.toLocaleString()} {currentPrice.symbol}
                  </p>
                </div>
              </div>

              {/* Choix Mobile Money */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-purple-400" /> Mobile Money
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {mobileMoneyProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedPaymentMethod(provider.id)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                        selectedPaymentMethod === provider.id
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl">{provider.icon}</div>
                      <p className="font-bold text-white text-xs md:text-sm">{provider.name}</p>
                    </button>
                  ))}
                </div>

                {/* Input Tel pour Mobile Money */}
                {selectedPaymentMethod && selectedPaymentMethod !== 'card' && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-purple-500/30 animate-fade-in">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+225 XX XX XX XX XX"
                      className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none"
                    />
                    <button 
                        onClick={handleMobilePayment}
                        disabled={!phoneNumber || isProcessing}
                        className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 text-white flex items-center justify-center gap-2"
                    >
                        {isProcessing ? "Envoi..." : `Payer ${currentPrice.price} ${currentPrice.symbol}`}
                    </button>
                  </div>
                )}
              </div>

              {/* Choix Carte Bancaire (Stripe) */}
              <div className="space-y-4 pt-4 border-t border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" /> Carte Bancaire
                </h3>
                
                <button
                  onClick={() => setSelectedPaymentMethod('card')}
                  className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                    selectedPaymentMethod === 'card'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <CreditCard className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">Visa / Mastercard</p>
                      <p className="text-sm text-gray-400">Paiement sécurisé via Stripe</p>
                    </div>
                  </div>
                </button>

                {/* Formulaire Stripe Sécurisé */}
                {selectedPaymentMethod === 'card' && stripePromise && (
                   <div className="mt-4 animate-fade-in">
                        <Elements stripe={stripePromise}>
                            <StripeCardForm 
                                amount={currentPrice.price}
                                currency={selectedCurrency}
                                user={user}
                                onSuccess={handleSuccess}
                                onError={handleError}
                                isProcessing={isProcessing}
                                setIsProcessing={setIsProcessing}
                            />
                        </Elements>
                   </div>
                )}
              </div>
              
              {/* Bouton retour (Le bouton payer est géré individuellement maintenant) */}
               <div className="pt-4">
                <button onClick={() => setStep(2)} className="w-full md:w-auto px-6 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-all text-sm">
                  Retour au choix de la devise
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4: CONFIRMATION */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in text-center py-12">
              <div className="inline-block p-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-4 shadow-lg shadow-green-500/30 animate-bounce-slow">
                <Check className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-4xl font-black text-white mb-2">Paiement Réussi ! 🎉</h2>
              <p className="text-gray-400 text-lg mb-8">
                Bienvenue dans la communauté ÉLITE de VISIONIA
              </p>
              
              <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-xl p-8 border border-purple-500/30 max-w-md mx-auto">
                <p className="text-sm text-gray-400 mb-2">Montant payé</p>
                <p className="text-3xl font-black text-white mb-4">
                  {currentPrice.price.toLocaleString()} {currentPrice.symbol}
                </p>
                <p className="text-sm text-gray-400">
                  Transaction ID: <span className="text-purple-400 font-mono">{transactionId?.slice(-8)}</span>
                </p>
              </div>
              
              <button onClick={onClose} className="mt-8 px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all">
                  Fermer et commencer
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EliteCheckout;