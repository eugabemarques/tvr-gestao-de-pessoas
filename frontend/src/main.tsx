/** Entrada: lê o usuário e os dados do servidor e monta a tela. */
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loja, perfil } from "./loja";
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

/**
 * Rede de segurança: um erro inesperado numa tela mostra um aviso com "Voltar", em vez de a página
 * inteira sumir (o React desmonta tudo quando um erro não é tratado). Os dados já gravados no
 * servidor não se perdem; só o que estava sendo digitado e ainda não foi salvo.
 */
class ProtecaoDeErro extends Component<{ children: ReactNode }, { erro: boolean; chave: number }> {
  state = { erro: false, chave: 0 };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  componentDidCatch(e: unknown) {
    console.error("Erro na tela", e);
  }
  render() {
    if (!this.state.erro) return <div key={this.state.chave} style={{ display: "contents" }}>{this.props.children}</div>;
    return (
      <main style={{ marginLeft: 0, display: "grid", placeItems: "center", minHeight: "100vh", padding: 16 }}>
        <section className="panel" style={{ maxWidth: 480, textAlign: "center", margin: 0 }}>
          <h2>Algo deu errado nesta tela</h2>
          <p>Os dados já salvos continuam guardados. O que estava sendo digitado e não foi salvo precisa ser preenchido de novo.</p>
          <button className="linkb" type="button" onClick={() => this.setState((s) => ({ erro: false, chave: s.chave + 1 }))}>
            Voltar
          </button>
        </section>
      </main>
    );
  }
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
    perfil.admin = !!usuario.admin;
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
      <ProtecaoDeErro>
        <App usuario={usuario} />
      </ProtecaoDeErro>
    </StrictMode>,
  );
}

void iniciar();
