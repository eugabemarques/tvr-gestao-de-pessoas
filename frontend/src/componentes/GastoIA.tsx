/** Contador de gasto da leitura de documentos com IA (Painel, só Admin RH). Atualiza a cada minuto e ao voltar para a aba. */
import { useEffect, useState } from "react";
import { obterGastoIA, type GastoIA as Dados } from "../servidor/api";

/** US$ em português; valores pequenos com 4 casas para não aparecer "US$ 0,00". */
export function dolar(v: number): string {
  const casas = v > 0 && v < 0.01 ? 4 : 2;
  return "US$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

const leituras = (n: number) => n + (n === 1 ? " leitura" : " leituras");

export function GastoIA({ oculto }: { oculto: boolean }) {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => {
    let vivo = true;
    const carregar = () =>
      obterGastoIA()
        .then((x) => vivo && setD(x))
        .catch(() => {});
    void carregar();
    const t = setInterval(carregar, 60000);
    const aoVoltar = () => {
      if (!document.hidden) void carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);
  if (!d) return null;
  const g = d.gasto;
  return (
    <section className="panel gastoia" aria-labelledby="t-gastoia" hidden={oculto}>
      <h2 id="t-gastoia">Leitura de documentos com IA</h2>
      {d.configurada ? null : <p className="mute">Leitura com IA desligada (sem chave configurada): o sistema usa o leitor do navegador, sem custo.</p>}
      <div className="gastos">
        <div>
          <span>Hoje</span>
          <b>{dolar(g.hoje.custo)}</b>
          <small>{leituras(g.hoje.leituras)}</small>
        </div>
        <div>
          <span>Este mês</span>
          <b>{dolar(g.mes.custo)}</b>
          <small>{leituras(g.mes.leituras)}</small>
        </div>
        <div>
          <span>Total</span>
          <b>{dolar(g.total.custo)}</b>
          <small>{leituras(g.total.leituras)}</small>
        </div>
      </div>
      <p className="mute">
        Custo real informado pela IA em cada leitura, desta chave.
        {g.semCusto ? " " + leituras(g.semCusto) + " feitas antes do contador não entram na soma (custo não registrado)." : ""}
      </p>
    </section>
  );
}
