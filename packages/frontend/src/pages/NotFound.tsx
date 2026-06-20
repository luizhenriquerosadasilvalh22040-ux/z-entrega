import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/ui';
import { Map, ArrowLeft, Home, Search } from 'lucide-react';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center p-8 space-y-6 border border-slate-100 dark:border-slate-800/80 shadow-xl">
        <div className="w-20 h-20 rounded-3xl bg-energy/10 text-energy flex items-center justify-center mx-auto animate-bounce">
          <Map size={40} />
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">404</h1>
          <h3 className="text-xl font-extrabold text-slate-700 dark:text-slate-200">Ops! Página perdida</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            O endereço que você tentou acessar não foi encontrado ou foi movido. Que tal voltar para a Home e pedir um lanche delicioso?
          </p>
        </div>

        <div className="flex gap-3 flex-wrap sm:flex-nowrap pt-2">
          <Button 
            variant="outline" 
            fullWidth 
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 justify-center"
          >
            <ArrowLeft size={16} /> Voltar
          </Button>
          <Button 
            fullWidth 
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 justify-center"
          >
            <Home size={16} /> Ir para a Home
          </Button>
        </div>
      </Card>
    </div>
  );
};
