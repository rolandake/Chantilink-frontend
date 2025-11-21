// 3. FRONTEND - src/components/EliteCheckout.jsx
// ============================================================================
import React, { useState } from 'react';
import { X, Check, CreditCard, Smartphone, Globe, ArrowRight, Shield, Zap, Crown, Star } from 'lucide-react';
import axios from 'axios';

const EliteCheckout = ({ onClose, onSuccess, user }) => {
  const [step, setStep] = useState(1);
  const [selectedCurrency, setSelectedCurrency] = useState('XOF');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState(null);

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
    { id: 'free', name: 'Free Money', icon: '🆓' },
    { id: 'wizall', name: 'Wizall Money', icon: '✨' },
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

  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // 1. Initialiser le paiement
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/payment/init`,
        {
          userId: user._id,
          amount: currentPrice.price,
          currency: selectedCurrency,
          paymentMethod: selectedPaymentMethod,
          phoneNumber: selectedPaymentMethod !== 'card' ? phoneNumber : null,
          cardToken: selectedPaymentMethod === 'card' ? 'tok_visa' : null // À remplacer par vrai token Stripe
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error);
      }

      const txId = response.data.transactionId;
      setTransactionId(txId);

      // 2. Si URL de paiement, rediriger
      if (response.data.paymentUrl) {
        window.location.href = response.data.paymentUrl;
        return;
      }

      // 3. Sinon, vérifier le statut périodiquement
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(
            `${process.env.REACT_APP_API_URL}/api/payment/status/${txId}`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          
          if (statusResponse.data.status === 'completed') {
            clearInterval(checkInterval);
            setStep(4);
            setTimeout(() => {
              if (onSuccess) onSuccess();
            }, 2000);
          } else if (statusResponse.data.status === 'failed') {
            clearInterval(checkInterval);
            alert('Paiement échoué. Veuillez réessayer.');
            setIsProcessing(false);
          }
        } catch (error) {
          console.error('Erreur vérification statut:', error);
        }
      }, 3000);

      // Arrêter après 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (isProcessing) {
          alert('Délai dépassé. Vérifiez votre transaction.');
          setIsProcessing(false);
        }
      }, 300000);

    } catch (error) {
      console.error('Erreur paiement:', error);
      alert(error.response?.data?.error || error.message || 'Erreur lors du paiement');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[9999] flex items-center justify-center p-4">
      <div className="relative bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-purple-500/30">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700 transition-all"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>

        <div className="h-2 bg-gray-800">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="p-8 overflow-y-auto max-h-[calc(90vh-8px)]">
          
          {/* ÉTAPE 1: AVANTAGES */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center">
                <div className="inline-block p-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl mb-4">
                  <Crown className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500 mb-2">
                  PASSEZ EN MODE ÉLITE
                </h2>
                <p className="text-gray-400">Débloquez tout le potentiel de VISIONIA</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {eliteFeatures.map((feature, idx) => (
                  <div 
                    key={idx}
                    className="p-6 bg-gray-800/50 rounded-xl border border-purple-500/20 hover:border-purple-500/50 transition-all"
                  >
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

              <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-xl p-6 border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">À partir de</p>
                    <p className="text-3xl font-black text-white">25 000 FCFA<span className="text-lg text-gray-400">/mois</span></p>
                  </div>
                  <button 
                    onClick={() => setStep(2)}
                    className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-bold text-lg hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    Continuer <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPE 2: DEVISE */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Choisissez votre devise</h2>
                <p className="text-gray-400">Sélectionnez la devise de votre pays</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {currencies.map((currency) => (
                  <button
                    key={currency.code}
                    onClick={() => setSelectedCurrency(currency.code)}
                    className={`p-6 rounded-xl border-2 transition-all text-left ${
                      selectedCurrency === currency.code
                        ? 'border-purple-500 bg-purple-500/20'
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

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-4 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition-all"
                >
                  Retour
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                >
                  Continuer <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3: PAIEMENT */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Moyen de paiement</h2>
                <p className="text-gray-400">Comment souhaitez-vous payer ?</p>
                <div className="mt-4 inline-block px-6 py-3 bg-purple-900/40 rounded-xl border border-purple-500/30">
                  <p className="text-2xl font-bold text-white">
                    {currentPrice.price.toLocaleString()} {currentPrice.symbol}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                  Mobile Money
                </h3>
                <div className="grid md:grid-cols-3 gap-3">
                  {mobileMoneyProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedPaymentMethod(provider.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedPaymentMethod === provider.id
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-3xl mb-2">{provider.icon}</div>
                      <p className="font-bold text-white text-sm">{provider.name}</p>
                    </button>
                  ))}
                </div>

                {selectedPaymentMethod && selectedPaymentMethod !== 'card' && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-purple-500/30">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Numéro de téléphone
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+225 XX XX XX XX XX"
                      className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  Carte Bancaire
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
                      <p className="text-sm text-gray-400">Paiement sécurisé SSL</p>
                    </div>
                  </div>
                </button>

                {selectedPaymentMethod === 'card' && (
                  <div className="space-y-4 p-4 bg-gray-800/50 rounded-xl border border-purple-500/30">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Numéro de carte
                      </label>
                      <input
                        type="text"
                        value={cardDetails.number}
                        onChange={(e) => setCardDetails({...cardDetails, number: e.target.value})}
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                        className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Expiration
                        </label>
                        <input
                          type="text"
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                          placeholder="MM/AA"
                          maxLength="5"
                          className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          CVV
                        </label>
                        <input
                          type="text"
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                          placeholder="123"
                          maxLength="3"
                          className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-4 bg-gray-800 rounded-xl font-bold hover:bg-gray-700 transition-all"
                  disabled={isProcessing}
                >
                  Retour
                </button>
                <button 
                  onClick={handlePayment}
                  disabled={!selectedPaymentMethod || isProcessing || 
                    (selectedPaymentMethod !== 'card' && !phoneNumber) ||
                    (selectedPaymentMethod === 'card' && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv))
                  }
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Payer {currentPrice.price.toLocaleString()} {currentPrice.symbol}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4: CONFIRMATION */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in text-center py-12">
              <div className="inline-block p-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-4">
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
                  Votre compte est maintenant ÉLITE pour 30 jours
                </p>
              </div>

              <div className="flex flex-col gap-3 max-w-md mx-auto mt-8">
                <div className="flex items-center gap-3 text-left p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-300">Analyse automatique activée</p>
                </div>
                <div className="flex items-center gap-3 text-left p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-300">Calculs illimités disponibles</p>
                </div>
                <div className="flex items-center gap-3 text-left p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-300">Support premium 24/7 actif</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EliteCheckout;