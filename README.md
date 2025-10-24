
# SportsAppV2

**SportsAppV2** is a full-stack, multi-sport analytics dashboard that merges a **React + TypeScript frontend** with **Python-based data pipelines**.  
It dynamically fetches and visualizes live and historical data from multiple official sports data sources — including **Formula 1**, **NBA**, **NFL**, and **UFC** — through their respective APIs.

---

## ⚙️ Project Overview

This project provides a single, unified dashboard where you can view live standings, player performance, and event results across different major sports.

- 🏁 **F1** – Drivers, races, podiums, and sprint data  
- 🏀 **NBA** – Team and player statistics (auto-updates during season)  
- 🏈 **NFL** – Team performance and season statistics  
- 🥊 **UFC** – Fighter rankings and results (via web scraping)

Each sport’s data is fetched by a **Python script**, written to `src/data` as JSON, and displayed dynamically in the React frontend.  
The entire app can be run in the browser or packaged into a **desktop GUI** using Electron.

---

## 🧩 Architecture

```plaintext
Python APIs  →  JSON files (/public/data)  →  React + Vite Frontend  →  Browser/Electron GUI
