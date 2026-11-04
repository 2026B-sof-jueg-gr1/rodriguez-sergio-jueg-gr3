# 🥁 Pixel Drums - 8-Bit Rhythm Game

**Mi Proyecto Phaser - Sergio Rodríguez**

Un juego de ritmo estilo "Guitar Hero" enfocado en tocar la batería, con estética pixel art de 8-bits, construido con **Phaser 3**.

## 🎮 Cómo Jugar

1. Abre el juego en [GitHub Pages](https://2026b-sof-jueg-gr3.github.io/rodriguez-sergio-jueg-gr3/mi-primer-juego/)
2. Usa las teclas **Q, W, E, R** para golpear las 4 pistas de la batería
3. Presiona la tecla correcta cuando la nota llegue a la zona de acierto

| Tecla | Instrumento | Color    |
|-------|-------------|----------|
| Q     | Hi-Hat      | 🔴 Rojo  |
| W     | Snare       | 🔵 Azul  |
| E     | Tom         | 🟢 Verde |
| R     | Kick        | 🟡 Amarillo |

## ✨ Características

- 🎵 **Generador de niveles por audio**: Sube tu propio archivo MP3/WAV y el juego genera notas automáticamente analizando los beats
- 🏪 **Tienda de personalización**: Gana monedas y desbloquea colores para la batería, baquetas y ropa del baterista
- 📈 **Sistema de progresión**: 5+ niveles con dificultad creciente
- 🎨 **Estética pixel art 8-bits**: Todas las texturas generadas proceduralmente
- 🎯 **Sistema de precisión**: PERFECT, GREAT, GOOD, OK con multiplicadores de combo

## 🛠️ Tecnologías

- **Phaser 3** (CDN) — Motor de juego
- **Arcade Physics** — Sistema de colisiones
- **Web Audio API** — Análisis de frecuencia para generación de niveles

## 📁 Estructura

```
mi-primer-juego/
├── index.html    # Punto de entrada, importa Phaser 3 vía CDN
└── game.js       # Lógica completa del juego (4 escenas)
```

## 🚀 Ejecutar Localmente

1. Clona el repositorio
2. Abre `mi-primer-juego/index.html` con **Live Server** en VS Code
3. ¡Juega!
