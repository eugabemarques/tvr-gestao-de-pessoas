namespace Toveri.Dominio.Cadastros;

public enum CategoriaDocumento
{
    Pessoal,
    Vacina,
    Outro,
}

/// <summary>Tipo de documento pedido aos colaboradores (RG, comprovante de residência, vacina etc.).</summary>
public class TipoDocumento
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public CategoriaDocumento Categoria { get; set; }
}

/// <summary>Documento pedido a todos os setores (SetorId vazio) ou a um setor específico.</summary>
public class RequisitoDocumento
{
    public int Id { get; set; }
    public int? SetorId { get; set; }
    public int TipoDocumentoId { get; set; }

    /// <summary>Falso para documentos que só entram se o colaborador tiver (ex.: passaporte).</summary>
    public bool Obrigatorio { get; set; } = true;
}

/// <summary>Arquivo enviado. O conteúdo fica no SharePoint; aqui ficam só os dados de controle.</summary>
public class DocumentoColaborador
{
    public int Id { get; set; }
    public int ColaboradorId { get; set; }

    /// <summary>Vazio para "outros documentos" e para certificados de curso.</summary>
    public int? TipoDocumentoId { get; set; }

    public string NomeArquivo { get; set; } = "";
    public string TipoConteudo { get; set; } = "";
    public long TamanhoBytes { get; set; }

    /// <summary>Identificador do arquivo no SharePoint (Microsoft Graph driveItem id).</summary>
    public string SharePointItemId { get; set; } = "";

    /// <summary>Data do documento, quando faz sentido (ex.: data da dose de uma vacina).</summary>
    public DateOnly? DataReferencia { get; set; }

    public DateTimeOffset EnviadoEm { get; set; }
    public string EnviadoPor { get; set; } = "";

    /// <summary>Preenchida quando um arquivo novo substitui este. O antigo é mantido no histórico.</summary>
    public DateTimeOffset? SubstituidoEm { get; set; }

    public bool Vigente => SubstituidoEm is null;
}

public class TipoCurso
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public bool EhAso { get; set; }
}

public class RequisitoCurso
{
    public int Id { get; set; }
    public int SetorId { get; set; }
    public int TipoCursoId { get; set; }
}

public class CursoColaborador
{
    public int Id { get; set; }
    public int ColaboradorId { get; set; }
    public int TipoCursoId { get; set; }
    public TipoCurso? TipoCurso { get; set; }
    public DateOnly Validade { get; set; }

    /// <summary>Certificado anexado.</summary>
    public int? DocumentoId { get; set; }
}

public static class Pendencias
{
    /// <summary>Tipos de documento obrigatórios para o setor que o colaborador ainda não enviou.</summary>
    public static IReadOnlyList<int> DocumentosPendentes(
        int setorId, IEnumerable<RequisitoDocumento> requisitos, IEnumerable<DocumentoColaborador> documentos)
    {
        var enviados = documentos.Where(d => d.Vigente && d.TipoDocumentoId is not null)
            .Select(d => d.TipoDocumentoId!.Value).ToHashSet();
        return requisitos
            .Where(r => r.Obrigatorio && (r.SetorId is null || r.SetorId == setorId))
            .Select(r => r.TipoDocumentoId)
            .Distinct()
            .Where(t => !enviados.Contains(t))
            .ToList();
    }

    /// <summary>Cursos obrigatórios para o setor que o colaborador ainda não tem cadastrados.</summary>
    public static IReadOnlyList<int> CursosPendentes(
        int setorId, IEnumerable<RequisitoCurso> requisitos, IEnumerable<CursoColaborador> cursos)
    {
        var cadastrados = cursos.Select(c => c.TipoCursoId).ToHashSet();
        return requisitos
            .Where(r => r.SetorId == setorId)
            .Select(r => r.TipoCursoId)
            .Distinct()
            .Where(t => !cadastrados.Contains(t))
            .ToList();
    }
}
