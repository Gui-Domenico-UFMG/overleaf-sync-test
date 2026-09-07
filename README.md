# Overleaf Firefox Cookie MCP (Work in Progress)

Este repositório documenta a intenção real de criar um servidor MCP (Model Context Protocol) para integração com o Overleaf. 

## Objetivo
O objetivo principal deste projeto é construir um servidor MCP que consiga autenticar e interagir com o Overleaf utilizando os cookies de sessão extraídos diretamente do navegador Firefox. Isso visa contornar a falta de uma API REST pública oficial e permitir a automação de projetos do Overleaf.

## Status Atual
🚧 **Em Construção (Work in Progress)** 🚧

A integração inicial que dependia das rotas antigas do Overleaf retornou erros (404), pois o Overleaf modificou sua estrutura web. Este repositório manterá todo o progresso atual e o histórico de testes (como o `main.tex`).

## Próximos Passos
Os próximos passos (a serem continuados por outra IA/Agente) envolvem:
- Extrair e gerenciar os cookies do Firefox programaticamente.
- Mapear as novas rotas internas ou adaptar o uso de WebSockets (se aplicável).
- Implementar as ferramentas do MCP para listar e modificar projetos usando a nova estratégia de sessão.

---
*Nota: Tudo que já foi feito (arquivos e configurações de teste) foi mantido intacto neste repositório para dar sequência ao trabalho.*
