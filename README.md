# 🎮 Gamium

**Plataforma de comunicação descentralizada, criptografada e P2P**

Gamium é uma aplicação de chat, mas completamente descentralizada usando Gun.js para comunicação peer-to-peer e criptografia end-to-end.

![Gamium](resources/icon.png)

## ✨ Características

### 💬 Comunicação
- **DMs (Mensagens Diretas)**: Chat privado 1-on-1 com criptografia ECDH
- **Servidores**: Crie servidores públicos/privados com múltiplos canais
- **Grupos**: Conversas em grupo com múltiplos participantes
- **Voz**: Canais de voz com WebRTC
- **Compartilhamento de Tela**: Stream sua tela em canais de voz

### 🔐 Segurança & Privacidade
- **P2P Descentralizado**: Sem servidores centrais
- **Criptografia E2E**: Todas as mensagens são criptografadas
- **Gun.js SEA**: Sistema de autenticação criptográfica
- **Chaves Públicas**: Identidade baseada em chaves criptográficas

### 👥 Social
- **Sistema de Amigos**: Adicione amigos por ID
- **Perfil com Avatar**: Personalize seu perfil
- **Status Online**: Veja quem está online
- **Gerenciamento de Servidores**: Crie canais, banir membros (owners)

### 🎨 Interface
- **Design Moderno**: Interface inspirada em aplicativos atuais
- **Tema Escuro**: Otimizado para longas sessões
- **Minimize para Bandeja**: Fica em segundo plano sem fechar
- **Janela Frameless**: UI customizada e moderna

### � Recovery Phrase (Recuperação de Conta)
- **Frase de 12 palavras**: Gerada na criação de conta
- **Recuperar em outro dispositivo**: Use a frase para restaurar conta
- **Backup universal**: Acesso à sua conta de qualquer computador
- **BIP39 standard**: Padrão criptográfico seguro

### �🔄 Auto-Update
- **Atualizações Automáticas**: Notificações de novas versões
- **Download em Background**: Baixe updates enquanto usa o app
- **Instalação Fácil**: Um clique para atualizar

## 🔏 Atualizações via GitHub Oficial

O auto-update usa exclusivamente o repositório oficial configurado no `electron-builder.json`:

- provider: `github`
- owner: `adessuquinho`
- repo: `gamium`

Defina no `.env`:

```env
GH_TOKEN=seu_token_github
```

Publicação:

```bash
npm run release:patch
```

## 🚀 Instalação

### Usuários

**Windows:**
1. Baixe `Gamium Setup x.x.x.exe` da [página de Releases](https://github.com/adessuquinho/gamium/releases)
2. Execute o instalador
3. Crie sua conta ou faça login

**Linux:**
```bash
# AppImage
chmod +x Gamium-x.x.x.AppImage
./Gamium-x.x.x.AppImage

# Debian/Ubuntu
sudo dpkg -i gamium_x.x.x_amd64.deb
```

**macOS:**
```bash
# Abra o .dmg e arraste para Applications
open Gamium-x.x.x.dmg
```

## 🔑 Recovery Phrase (Recuperação de Conta)

### O que é?
Uma **Recovery Phrase** é uma sequência de 12 palavras geradas na criação da conta que permite restaurar seu acesso em outro dispositivo.

### Como Funciona

**Na Criação de Conta:**
1. Registre uma nova conta
2. Uma tela especial exibe suas 12 palavras únicas
3. Copie ou anote em um lugar seguro
4. Confirme que guardou
5. Pronto! Sua conta está criada

**Para Restaurar em Outro Dispositivo:**
1. Abra Gamium em novo computador
2. Na tela de login, clique em "🔑 Restaurar com Recovery Phrase"
3. Digite seu nome de usuário
4. Cole suas 12 palavras
5. Sua conta será completamente restaurada!

### ⚠️ Segurança

**FAÇA:**
- ✅ Guarde em lugar seguro (cofre, gestor de senhas, papel)
- ✅ Nunca compartilhe com ninguém
- ✅ Faça múltiplas cópias em locais diferentes
- ✅ Guarde offline

**NÃO FAÇA:**
- ❌ Screenshot no computador
- ❌ Enviar por email ou mensagem
- ❌ Compartilhar em redes sociais
- ❌ Ignorar (você pode precisar!)

## 🌐 Tecnologias

- **Electron** - Framework desktop multiplataforma
- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool ultra-rápida
- **Gun.js** - Banco de dados P2P descentralizado
- **WebRTC** - Comunicação de voz/vídeo em tempo real
- **Zustand** - State management minimalista
- **electron-updater** - Sistema de auto-update
- **BIP39** - Padrão de recovery phrases

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🐛 Reportar Bugs

Encontrou um bug? [Abra uma issue](https://github.com/adessuquinho/gamium/issues)

Inclua:
- Descrição do problema
- Passos para reproduzir
- Versão do app
- Sistema operacional

## 📧 Contato

- GitHub: [@adessuquinho](https://github.com/adessuquinho)
- Issues: [github.com/adessuquinho/gamium/issues](https://github.com/adessuquinho/gamium/issues)

---

**Feito com ❤️ e P2P**