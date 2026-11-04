# 🎸 PIXEL DRUMS: GUITAR HERO 3D EDITION + MODO 1 VS 1 ONLINE

**Mi Proyecto Phaser - Sergio Rodríguez**

Videojuego de ritmo con estética clásica **Guitar Hero en perspectiva Pseudo-3D Pixel Art** y **Modo Multijugador 1 vs 1 Online P2P (WebRTC/PeerJS)**, desarrollado con **Phaser 3**, **Web Audio API** y **Arcade Physics**.

---

## 🎮 Enlaces del Proyecto

- 🚀 **Juego en GitHub Pages:** [https://2026b-sof-jueg-gr1.github.io/rodriguez-sergio-jueg-gr3/](https://2026b-sof-jueg-gr1.github.io/rodriguez-sergio-jueg-gr3/)
- 📁 **Acceso directo al juego:** [https://2026b-sof-jueg-gr1.github.io/rodriguez-sergio-jueg-gr3/mi-primer-juego/](https://2026b-sof-jueg-gr1.github.io/rodriguez-sergio-jueg-gr3/mi-primer-juego/)
- 💻 **Repositorio de Código:** [https://github.com/2026B-sof-jueg-gr1/rodriguez-sergio-jueg-gr3](https://github.com/2026B-sof-jueg-gr1/rodriguez-sergio-jueg-gr3)

---

## ⚔️ MODO 1 VS 1 MULTIJUGADOR EN EL NAVEGADOR (P2P WebRTC)

¡Ahora puedes retar a cualquier amigo desde dos navegadores distintos sin instalar nada ni requerir servidores externos!

### ¿Cómo funciona el Lobby con Código?
1. **El Anfitrión (Host):**
   - Hace clic en **"⚔ DUELO 1 VS 1 ONLINE ⚔"** en el menú principal.
   - En la pestaña **"CREAR SALA"**, el juego generará un código único (por ejemplo: `ROCK-4821`).
   - El anfitrión copia el código y se lo envía a su rival (por WhatsApp, Discord, Teams, etc.).
2. **El Rival (Invitado):**
   - Entra al juego en su navegador y hace clic en **"⚔ DUELO 1 VS 1 ONLINE ⚔"**.
   - Cambia a la pestaña **"UNIRSE A SALA"**, escribe o pega el código recibido y pulsa **"🚀 ENTRAR AL DUELO"**.
3. **El Duelo en Vivo:**
   - La conexión WebRTC P2P se enlaza inmediatamente.
   - Ambos jugadores tocan la misma canción en tiempo real.
   - En pantalla verás la **Puntuación del Rival**, su **Combo**, y una **Barra de Balance de Duelo (Tug-of-War)** estilo *Guitar Hero Face-Off* que indica en tiempo real quién va ganando.
4. **Pantalla de Victoria / Revancha:**
   - Al finalizar, se compara puntuación, precisión, aciertos y fallos proclamando al **Ganador del Duelo**, con botón de **Revancha** inmediata.

---

## 🕹️ Controles (4 Carriles Guitar Hero)

| Tecla | Carril / Instrumento | Color Clásico | Función |
| :---: | :--- | :---: | :--- |
| **Q** | Hi-Hat | 🟢 Verde | Golpear / Mantener pulsado |
| **W** | Snare (Tarola) | 🔴 Rojo | Golpear / Mantener pulsado |
| **E** | Tom | 🟡 Amarillo | Golpear / Mantener pulsado |
| **R** | Kick (Bombo) | 🔵 Azul | Golpear / Mantener pulsado |
| **ESC** | Menú / Pausa | - | Salir al resumen |

---

## 🔥 Mecánicas de Dificultad Avanzada

1. **Perspectiva 3D Pixel Art (Carretera Guitar Hero)**: Proyección cónica 3D con gemas beveled que aumentan de escala al acercarse a la cámara.
2. **Línea de Acierto Móvil (Sube y Baja)**: A partir del Nivel 3, los receptores oscilan dinámicamente arriba y abajo exigiendo cálculo de timing reactivo.
3. **Notas Sostenidas (Hold Notes)**: Rayos láser de electricidad pixel art donde debes mantener la tecla presionada durante el solo.
4. **Tablero Rotatorio (Vertical ⮀ Horizontal)**: En niveles 4 y 5, el tablero rota $90^\circ$ en tiempo real.
5. **Pantalla Completa Responsiva**: Ocupa el 100% de cualquier pantalla o resolución.
6. **Generador de Audio Propio**: Sube MP3/WAV y analiza beats y sustain con Web Audio API.
7. **Sintetizador 8-Bit**: Sonidos de batería acústica/eléctrica generados en tiempo real.
8. **Tienda y Personalización**: Personaliza colores de batería, baquetas y ropa.

---

## 🚀 Cómo Ejecutar Localmente

1. Clona el repositorio:
   ```bash
   git clone https://github.com/2026B-sof-jueg-gr1/rodriguez-sergio-jueg-gr3.git
   ```
2. Abre la carpeta con VS Code y lanza `index.html` con **Live Server**.
