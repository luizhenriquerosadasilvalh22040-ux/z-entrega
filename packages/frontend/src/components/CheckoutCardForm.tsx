import React, { useEffect, useState } from 'react';
import { Button } from './ui';
import { Loader2 } from 'lucide-react';

interface CheckoutCardFormProps {
  amount: number;
  email?: string;
  onSuccess: (token: string, issuerId: string, paymentMethodId: string, installments: number) => void;
  onError: (error: string) => void;
  buttonDisabled?: boolean;
}

export const CheckoutCardForm: React.FC<CheckoutCardFormProps> = ({ amount, email, onSuccess, onError, buttonDisabled }) => {
  const [loading, setLoading] = useState(false);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);

  useEffect(() => {
    // Check if MP SDK is already loaded
    if ((window as any).MercadoPago) {
      setIsSdkLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => setIsSdkLoaded(true);
    document.body.appendChild(script);

    return () => {
      // document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!isSdkLoaded) return;

    const mp = new (window as any).MercadoPago(import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY);
    
    // Clear previous elements if re-rendering
    const formElement = document.getElementById('form-checkout');
    if (formElement) {
       // mp.cardForm will handle binding if we re-instantiate, 
       // but we need to ensure the DOM nodes are clean. We don't have an unmount method for cardForm easily,
       // so we just rely on it replacing contents or binding to empty divs.
    }

    const cardForm = mp.cardForm({
      amount: amount.toString(),
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

          const {
            paymentMethodId,
            issuerId,
            token,
            installments,
          } = cardForm.getCardFormData();

          if (!token) {
            setLoading(false);
            onError('Erro ao gerar token do cartão. Verifique os dados inseridos.');
            return;
          }

          onSuccess(token, issuerId, paymentMethodId, installments);
        },
      },
    });

    return () => {
       // Cleanup if possible
    };
  }, [isSdkLoaded, amount, email, onSuccess, onError]);

  return (
    <form id="form-checkout" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Número do Cartão</label>
          <div id="form-checkout__cardNumber" className="h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center bg-white dark:bg-slate-900"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Validade</label>
            <div id="form-checkout__expirationDate" className="h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center bg-white dark:bg-slate-900"></div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">CVV</label>
            <div id="form-checkout__securityCode" className="h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center bg-white dark:bg-slate-900"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Titular do Cartão</label>
          <input type="text" id="form-checkout__cardholderName" className="h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 dark:text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">E-mail</label>
          <input type="email" id="form-checkout__cardholderEmail" className="h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 dark:text-white" defaultValue={email || ''} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Doc do Titular (CPF)</label>
          <div className="flex gap-2">
            <select id="form-checkout__identificationType" className="w-24 h-11 px-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 dark:text-white"></select>
            <input type="text" id="form-checkout__identificationNumber" className="flex-1 h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 dark:text-white" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Parcelas</label>
          <select id="form-checkout__installments" className="h-11 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 dark:text-white"></select>
        </div>
      </div>

      <div className="hidden">
        <select id="form-checkout__issuer"></select>
      </div>

      <div className="pt-2">
        <Button 
          type="submit" 
          id="form-checkout__submit" 
          fullWidth 
          size="lg"
          disabled={loading || buttonDisabled}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Processando Pagamento...
            </span>
          ) : (
            'Confirmar e Enviar Pedido'
          )}
        </Button>
      </div>
    </form>
  );
};
