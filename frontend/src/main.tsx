/** Entrada: lê o usuário e os dados do servidor e monta a tela. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loja } from "./loja";
import { AcessoNegado, obterEstado, obterUsuario, SessaoExpirada, URL_LOGOUT, type Usuario } from "./servidor/api";
import "./estilos.css";

const raiz = createRoot(document.getElementById("root") as HTMLElement);

function Mensagem({ texto, sair }: { texto: string; sair?: boolean }) {
  return (
    <main style={{ marginLeft: 0, display: "grid", placeItems: "center", minHeight: "100vh", padding: 16 }}>
      <section className="panel" style={{ maxWidth: 480, textAlign: "center", margin: 0 }}>
        <h2>TOVERI - Gestão de Pessoas</h2>
        <p>{texto}</p>
        {sair ? (
          <p style={{ margin: 0 }}>
            <a className="linkb" href={URL_LOGOUT}>
              Sair
            </a>
          </p>
        ) : null}
      </section>
    </main>
  );
}

function iniciarSincronizacao(): void {
  setInterval(() => void loja.verificar(), 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void loja.verificar();
  });
  window.addEventListener("beforeunload", (e) => {
    if (loja.pendente()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

async function iniciar(): Promise<void> {
  raiz.render(<Mensagem texto="Carregando…" />);
  let usuario: Usuario;
  try {
    usuario = await obterUsuario();
  } catch (e) {
    if (e instanceof SessaoExpirada) return;
    if (e instanceof AcessoNegado) {
      raiz.render(<Mensagem texto="Seu acesso ainda não foi liberado. Peça ao administrador." sair />);
      return;
    }
    raiz.render(<Mensagem texto="Não foi possível conectar ao servidor. Tente recarregar a página." />);
    return;
  }
  try {
    loja.iniciar(await obterEstado());
  } catch (e) {
    if (e instanceof SessaoExpirada) return;
    raiz.render(<Mensagem texto="Não foi possível carregar os dados. Tente recarregar a página." />);
    return;
  }
  iniciarSincronizacao();
  raiz.render(
    <StrictMode>
      <App usuario={usuario} />
    </StrictMode>,
  );
}

void iniciar();
