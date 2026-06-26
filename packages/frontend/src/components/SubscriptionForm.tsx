import React, { useEffect, useState } from 'react';
import { Card, Button } from './ui';

export const SubscriptionForm = ({ user }: { user: any }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user?.subscriptionStatus === 'ACTIVE' || success) return;
    
    // Initialize MercadoPago CardForm
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      const mp = new (window as any).MercadoPago(import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY);
      const cardForm = mp.cardForm({
        amount: '125.00',
        iframe: true,
        form: {
          id: 'form-checkout',
          cardNumber: {
            id: 'form-checkout__cardNumber',
            placeholder: 'Número do Cartão',
          },
          expirationDate: {
            id: 'form-checkout__expirationDate',
            placeholder: 'MM/YY',
          },
          securityCode: {
            id: 'form-checkout__securityCode',
            placeholder: 'CVV',
          },
          cardholderName: {
            id: 'form-checkout__cardholderName',
            placeholder: 'Titular do Cartão',
          },
          issuer: {
            id: 'form-checkout__issuer',
            placeholder: 'Banco Emissor',
          },
          installments: {
            id: 'form-checkout__installments',
            placeholder: 'Parcelas',
          },
          identificationType: {
            id: 'form-checkout__identificationType',
            placeholder: 'Tipo de Documento',
          },
          identificationNumber: {
            id: 'form-checkout__identificationNumber',
            placeholder: 'Número do Documento',
          },
          cardholderEmail: {
            id: 'form-checkout__cardholderEmail',
            placeholder: 'E-mail',
          },
        },
        callbacks: {
          onFormMounted: (error: any) => {
            if (error) return console.warn('Form Mounted handling error: ', error);
          },
          onSubmit: (event: any) => {
            event.preventDefault();
            setLoading(true);
            setError('');

            const {
              token,
              cardholderEmail,
            } = cardForm.getCardFormData();

            fetch(`${import.meta.env.VITE_API_URL}/payments/subscription`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({
                cardToken: token,
                email: cardholderEmail,
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error('Falha ao processar pagamento');
                return res.json();
              })
              .then((data) => {
                setSuccess(true);
                setTimeout(() => window.location.reload(), 2000);
              })
              .catch((err) => {
                setError('Erro ao processar assinatura. Verifique os dados do cartão.');
              })
              .finally(() => {
                setLoading(false);
              });
          },
        },
      });
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [user, success]);

  if (user?.subscriptionStatus === 'ACTIVE' || success) {
    return (
      <Card className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-slate-800">Assinatura Ativa!</h3>
        <p className="text-slate-500">Sua assinatura está em dia. Você pode continuar utilizando todos os recursos da plataforma.</p>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-2xl font-bold text-slate-800">Ativar Assinatura</h3>
        <p className="text-sm text-slate-500">
          Ative sua assinatura para continuar recebendo pedidos. O valor é de <strong>R$ 125,00/mês</strong>.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-semibold text-center border border-red-200">
          {error}
        </div>
      )}

      <form id="form-checkout" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Número do Cartão</label>
            <div id="form-checkout__cardNumber" className="h-11 px-3 border border-slate-200 rounded-xl flex items-center"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">Vencimento</label>
              <div id="form-checkout__expirationDate" className="h-11 px-3 border border-slate-200 rounded-xl flex items-center"></div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">CVV</label>
              <div id="form-checkout__securityCode" className="h-11 px-3 border border-slate-200 rounded-xl flex items-center"></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Titular do Cartão</label>
            <input type="text" id="form-checkout__cardholderName" className="h-11 px-3 border border-slate-200 rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">E-mail</label>
            <input type="email" id="form-checkout__cardholderEmail" className="h-11 px-3 border border-slate-200 rounded-xl" defaultValue={user?.email || ''} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Tipo de Documento</label>
            <select id="form-checkout__identificationType" className="h-11 px-3 border border-slate-200 rounded-xl"></select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Número do Documento</label>
            <input type="text" id="form-checkout__identificationNumber" className="h-11 px-3 border border-slate-200 rounded-xl" />
          </div>
        </div>

        <div className="hidden">
          <select id="form-checkout__issuer"></select>
          <select id="form-checkout__installments"></select>
        </div>

        <div className="pt-4 mt-6 border-t border-slate-100">
          <Button type="submit" id="form-checkout__submit" fullWidth disabled={loading}>
            {loading ? 'Processando...' : 'Assinar por R$ 125,00/mês'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
