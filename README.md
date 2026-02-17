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

### 🔄 Auto-Update
- **Atualizações Automáticas**: Notificações de novas versões
- **Download em Background**: Baixe updates enquanto usa o app
- **Instalação Fácil**: Um clique para atualizar

## 🚀 Instalação

### Usuários

**Windows:**
1. Baixe `Gamium Setup x.x.x.exe` da [página de Releases](https://github.com/SEU-USUARIO/gamium/releases)
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

## 🛠️ Desenvolvimento

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Setup
```bash
# Clone o repositório
git clone https://github.com/adessuquinho/gamium.git
cd gamium

# Instale dependências
npm install

# Execute em modo dev
npm run dev
```

### Scripts
```bash
npm run dev        # Modo desenvolvimento
npm run build      # Build do Vite
npm run package    # Criar instalador (não publica)
npm run publish    # Build e publicar no GitHub
npm start          # Executar versão build
```

## 📦 Estrutura do Projeto

```
gamium/
├── src/
│   ├── main/               # Processo principal Electron
│   │   └── index.ts        # Lógica principal, IPC, auto-update
│   ├── preload/            # Script preload (contextBridge)
│   │   └── preload.ts      # API exposta ao renderer
│   ├── renderer/           # Interface React
│   │   ├── components/     # Componentes React
│   │   │   ├── MainLayout.tsx
│   │   │   ├── ServersPanel.tsx
│   │   │   ├── ChatView.tsx
│   │   │   ├── FriendsPanel.tsx
│   │   │   └── ...
│   │   ├── network.ts      # Lógica P2P Gun.js
│   │   ├── store.ts        # Zustand state management
│   │   ├── App.tsx         # Componente raiz
│   │   └── App.css         # Estilos globais
│   └── shared/
│       └── types.ts        # TypeScript types compartilhados
├── resources/              # Ícones e recursos
├── electron-builder.json   # Configuração do builder
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🌐 Tecnologias

- **Electron** - Framework desktop multiplataforma
- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool ultra-rápida
- **Gun.js** - Banco de dados P2P descentralizado
- **WebRTC** - Comunicação de voz/vídeo em tempo real
- **Zustand** - State management minimalista
- **electron-updater** - Sistema de auto-update

## 🔧 Configuração

### Relay Servers Gun.js
Por padrão, o Gamium usa servidores relay públicos:
```typescript
// src/renderer/network.ts
const gun = Gun({
  peers: [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://gunjs.herokuapp.com/gun'
  ]
})
```

Para usar seu próprio relay:
```bash
# Clone e rode Gun relay
git clone https://github.com/amark/gun.git
cd gun
npm install
node examples/http.js
```

Atualize os peers no `network.ts` para `http://localhost:8765/gun`

### Publicar Updates
Veja [AUTO_UPDATE.md](AUTO_UPDATE.md) para instruções detalhadas de como publicar atualizações.

## 🤝 Contribuindo

Contribuições são bem-vindas! 

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🐛 Reportar Bugs

Encontrou um bug? [Abra uma issue](https://github.com/SEU-USUARIO/gamium/issues)

Inclua:
- Descrição do problema
- Passos para reproduzir
- Versão do app
- Sistema operacional

## 💡 Roadmap

- [ ] Mensagens de voz
- [ ] Compartilhamento de arquivos P2P
- [ ] Temas personalizáveis
- [ ] Plugins/extensões
- [ ] Modo anônimo (sem localStorage)
- [ ] Integração com IPFS
- [ ] Multi-linguagem (i18n)
- [ ] Mobile (React Native)

## 📧 Contato

- GitHub: [@SEU-USUARIO](https://github.com/SEU-USUARIO)
- Issues: [github.com/SEU-USUARIO/gamium/issues](https://github.com/SEU-USUARIO/gamium/issues)

---

**Feito com ❤️ e P2P**

