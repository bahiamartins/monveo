# Segurança

## Credenciais Google

- Use uma **service account** com escopo mínimo necessário (Vertex AI, Firestore, Storage conforme o caso).
- O arquivo JSON da chave deve ficar como `backend/google_auth.json` **apenas na sua máquina ou em secret store** — ele está listado no `.gitignore` e **não deve ser enviado ao GitHub**, nem colado em issues ou chats.
- Para novos clones: copie `backend/google_auth.example.json` para `backend/google_auth.json` e substitua pelos valores reais obtidos no [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts) (criar chave JSON).

## Se uma chave vazou

1. No Console GCP: **IAM e administrador** → **Contas de serviço** → chave → **Excluir** a chave comprometida.
2. Crie uma **nova** chave JSON e atualize o arquivo local / variáveis de ambiente.
3. Se o repositório chegou a receber o arquivo em um commit, além de trocar a chave considere usar `git filter-repo` ou suporte do GitHub para remover o histórico sensível.

## Dependências

Mantenha `pip` e `npm` atualizados e rode auditorias periodicamente (`npm audit`, etc.).

## Reportar problemas

Em repositório privado da equipe, abra um issue restrito ou use o canal interno de segurança da organização.
