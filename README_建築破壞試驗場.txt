國軍模擬器｜建築破壞試驗場 v0.1
====================================

這版用遊戲現有的三種 GLB 建築製作「預先切塊」模型：
- 營舍：23 塊 (原始建築 building-1-barracks.glb)
- 哨所：30 塊 (原始建築 building-4-guardhouse.glb)
- 辦公大樓：42 塊 (原始建築 building-6-office.glb)

此 ZIP 僅新增檔案，不會覆蓋主遊戲地圖或原本的建築模型。

放進 GitHub ARMY2 專案後，開啟：
https://vmylife.github.io/ARMY2/grenade-destruction-test.html

操作：
1. 選擇營舍／哨所／辦公大樓
2. 選擇正面命中、炸左邊或丟太遠
3. 按「手榴彈！」觀察飛行、落點判定與碎塊炸飛落地
4. 按「重新蓋好」恢復原位，繼續測試

檔案：
- grenade-destruction-test.html（獨立 WebGL2 試驗場）
- assets/buildings/destructible/*-fractured.glb（三個已預分塊模型，保留原貼圖）
- assets/buildings/destructible/*-fractured.json（三份碎塊座標與來源紀錄，方便後續整合）

技術說明：
- 這是模型外表面分塊。每一個原始三角面只被指定到其中一個碎塊；重組時外觀與原本一致。
- 破壞時每塊有獨立的位移、旋轉、重力、簡化反彈；不是耗能的即時網格切割。
- 碎塊內側未封厚實切面，因此近距離觀察可能像空心外殼。未來可補內側斷面材質。
- 目前只在獨立試驗場觸發；尚未接入軍營主地圖或正式手榴彈準度小遊戲。
- WebGL2 須使用支援的瀏覽器。iPhone / Android 以 Safari/Chrome 開啟。
