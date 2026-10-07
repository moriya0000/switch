/* =========================================================
   関鉄発車標
   メインシステム
========================================================= */


/* =========================================================
   1. 定数
========================================================= */

const DEST_MAP = {
    "取　手": "Toride",
    "水海道": "Mitsukaido",
    "下　館": "Shimodate",
    "下　妻": "Shimotsuma",
    "守　谷": "Moriya",
    "新守谷": "ShinMoriya"
};

const TYPE_MAP = {
    "普通": "Local",
    "快速": "Rapid"
};

const HOLIDAYS = {
    2026: [
        "2026-01-01",
        "2026-01-12",
        "2026-02-11",
        "2026-02-23",
        "2026-03-20",
        "2026-04-29",
        "2026-05-03",
        "2026-05-04",
        "2026-05-05",
        "2026-07-20",
        "2026-08-11",
        "2026-09-21",
        "2026-09-23",
        "2026-10-12",
        "2026-11-03",
        "2026-11-23"
    ]
};


/* =========================================================
   2. 状態
========================================================= */

let trainsUp = [];
let trainsDown = [];

let currentDayType = "";
let manualDayType = null;

let lang = "ja";

let showGuideSecondRow = false;
let currentGuideMessageUp = "";
let currentGuideMessageDown = "";

let showDelayNormal = true;

let guideTimer = null;

const delays = {};


/* =========================================================
   3. DOM
========================================================= */

const $ = (selector) =>
    document.querySelector(selector);

const boardElement =
    $("#board");


/* =========================================================
   4. CSV
========================================================= */

function parseCsv(csv) {

    return csv
        .trim()
        .split("\n")
        .map(line => {

            const columns =
                line.split(",");

            return {
                no: columns[0]?.trim() || "",
                dest: columns[1]?.trim() || "",
                track: columns[2]?.trim() || "",
                time: columns[3]?.trim() || "",
                type: columns[4]?.trim() || "",
                trackno: columns[5]?.trim() || "",
                cars: columns[6]?.trim() || "",
                arrivalMin:
                    Number(columns[7] || 1)
            };
        });
}


/* =========================================================
   5. 祝日判定
========================================================= */

function isJapaneseHoliday(date) {

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    const key =
        `${year}-${month}-${day}`;

    return (
        HOLIDAYS[year]?.includes(key) ??
        false
    );
}


/* =========================================================
   6. ダイヤ種別
========================================================= */

function getAutomaticDayType() {

    const now =
        new Date();

    const day =
        now.getDay();

    const weekend =
        day === 0 ||
        day === 6;

    const holiday =
        isJapaneseHoliday(now);

    return (
        weekend || holiday
    )
        ? "holiday"
        : "weekday";
}


function loadTimetableByDayType() {

    const dayType =
        manualDayType ??
        getAutomaticDayType();

    if (
        currentDayType === dayType &&
        trainsUp.length &&
        trainsDown.length
    ) {
        updateTimetableStatus();
        return;
    }

    currentDayType =
        dayType;

    if (dayType === "holiday") {

        trainsUp =
            parseCsv(csvUpHoliday);

        trainsDown =
            parseCsv(csvDownHoliday);

    } else {

        trainsUp =
            parseCsv(csvUpWeekday);

        trainsDown =
            parseCsv(csvDownWeekday);
    }

    updateBoard();
    updateTimetableStatus();
}


/* =========================================================
   7. 時刻処理
========================================================= */

function getRemainingTime(train) {

    if (!train) {
        return Infinity;
    }

    const now =
        new Date();

    const [hours, minutes] =
        train.time
            .split(":")
            .map(Number);

    const departure =
        new Date(now);

    departure.setHours(
        hours,
        minutes,
        0,
        0
    );


    const delay =
        delays[train.no] || 0;

    departure.setMinutes(
        departure.getMinutes() + delay
    );


    /*
     * 0～3時台を日付跨ぎとして処理
     */
    const currentHour =
        now.getHours();

    if (
        hours < 4 &&
        currentHour >= 4
    ) {

        departure.setDate(
            departure.getDate() + 1
        );

    } else if (
        hours >= 4 &&
        currentHour < 4
    ) {

        departure.setDate(
            departure.getDate() - 1
        );
    }


    return (
        departure.getTime() -
        now.getTime()
    ) / 1000;
}


function isArrivingSoon(train) {

    if (!train) {
        return false;
    }

    const remaining =
        getRemainingTime(train);

    const before =
        (train.arrivalMin || 1) * 60;

    return (
        remaining <= before &&
        remaining > before - 60
    );
}


function getNextTrains(trains) {

    const now =
        new Date();

    const nowMinutes =
        now.getHours() * 60 +
        now.getMinutes();

    return trains
        .filter(train => {

            const [hours, minutes] =
                train.time
                    .split(":")
                    .map(Number);

            let trainMinutes =
                hours * 60 +
                minutes +
                (delays[train.no] || 0);


            if (
                hours < 4 &&
                now.getHours() >= 4
            ) {

                trainMinutes +=
                    24 * 60;
            }


            return (
                trainMinutes >
                nowMinutes
            );
        })
        .slice(0, 2);
}


/* =========================================================
   8. 案内文
========================================================= */

function normalizeDest(dest) {

    return dest.replace(
        /\s+/g,
        ""
    );
}


function generateGuideMessageUp(train) {

    if (!train) {
        return "";
    }

    const dest =
        normalizeDest(train.dest);


    if (train.track === "乗") {
        return `こんどの${dest}行きは水海道にて乗り換えとなります。`;
    }

    if (train.track === "始") {
        return `こんどの${dest}行きは当駅始発の列車です。`;
    }

    if (train.track === "接") {
        return `こんどの${dest}行きは水海道にて快速に接続いたします。`;
    }

    if (train.cars === "1") {
        return `こんどの${dest}行きは1両編成でまいります。`;
    }

    if (train.type === "快速") {
        return "終点取手まで各駅に停車いたします。";
    }

    if (train.no === "") {
        return "本日の上り列車はすべて終了いたしました。";
    }

    return `こんどの${dest}行のご案内です`;
}


function generateGuideMessageDown(train) {

    if (!train) {
        return "";
    }

    const dest =
        normalizeDest(train.dest);


    if (train.track === "乗") {
        return `こんどの${dest}行きは水海道にて乗り換えとなります。`;
    }

    if (train.track === "始") {
        return `こんどの${dest}行きは当駅始発の列車です。`;
    }

    if (train.track === "接") {
        return `こんどの${dest}行きは水海道にて快速に接続いたします。`;
    }

    if (train.track === "快") {
        return `こんどの${dest}行きは守谷にて快速に接続いたします。`;
    }

    if (train.cars === "1") {
        return `こんどの${dest}行きは1両編成でまいります。`;
    }

    if (train.type === "快速") {
        return `こんどの${dest}行きは快速列車です。停車駅にご注意ください。`;
    }

    return `こんどの${dest}行のご案内です`;
}


/* =========================================================
   9. 案内表示
========================================================= */

function showGuideOnce() {

    const upTrains =
        getNextTrains(trainsUp);

    const downTrains =
        getNextTrains(trainsDown);


    currentGuideMessageUp =
        generateGuideMessageUp(
            upTrains[0]
        );

    currentGuideMessageDown =
        generateGuideMessageDown(
            downTrains[0]
        );


    showGuideSecondRow = true;

    updateBoard();


    if (guideTimer !== null) {
        clearTimeout(guideTimer);
    }


    guideTimer =
        setTimeout(() => {

            showGuideSecondRow =
                false;

            updateBoard();

            guideTimer = null;

        }, 15000);
}


/* =========================================================
   10. 行描画
========================================================= */

function renderRow(train) {

    if (!train) {

        return `
            <div class="row">
                <div></div>
                <div></div>
                <div></div>
            </div>
        `;
    }


    const delay =
        delays[train.no] || 0;


    const time =
        train.time;


    let displayTime;


    if (delay > 0) {

        displayTime =
            showDelayNormal

                ? `<span>${time}</span>`

                : `<span class="delay">
                    遅れ${delay}分
                   </span>`;

    } else {

        displayTime =
            `<span>${time}</span>`;
    }


    const type =
        lang === "ja"
            ? train.type
            : TYPE_MAP[train.type] || train.type;


    const dest =
        lang === "ja"
            ? train.dest
            : DEST_MAP[train.dest] || train.dest;


    return `
        <div class="row">

            <div class="type ${
                train.type === "快速"
                    ? "rapid"
                    : ""
            }">
                ${type}
            </div>

            <div class="dest">
                ${dest}
            </div>

            <div class="time2">
                ${displayTime}
            </div>

        </div>
    `;
}


/* =========================================================
   11. ブロック描画
========================================================= */

function renderBlock(block) {

    const firstTrain =
        block.trains[0];

    const secondTrain =
        block.trains[1];

    const arriving =
        firstTrain
            ? isArrivingSoon(firstTrain)
            : false;


    let html = `

        <div
            class="block"
            data-direction="${block.direction}"
        >

            <div class="block-title">

                <div class="no">
                    ${block.noLeft}
                </div>

                <div class="block-title__text">
                    ${block.title}
                </div>

                <div class="no">
                    ${block.noRight}
                </div>

            </div>


            <div class="header">
                <div>種別</div>
                <div>行先</div>
                <div>発車時刻</div>
            </div>


            <div class="table">
    `;


    /*
     * 1列目
     */
    html +=
        renderRow(firstTrain);


    /*
     * 2列目
     */
    if (arriving) {

        html += `
            <div class="row arrival blink">
                <div>
                    列車がまいります
                </div>
            </div>
        `;

    } else if (showGuideSecondRow) {

        const message =
            block.direction === "up"
                ? currentGuideMessageUp
                : currentGuideMessageDown;


        if (
            message &&
            !message.includes("ご案内です")
        ) {

            html += `
                <div class="row arrival scroll">
                    <div>
                        <span>
                            ${message}
                        </span>
                    </div>
                </div>
            `;

        } else {

            html +=
                renderRow(secondTrain);
        }

    } else {

        html +=
            renderRow(secondTrain);
    }


    html += `
            </div>
        </div>
    `;

    return html;
}


/* =========================================================
   12. ボード更新
========================================================= */

function updateBoard() {

    if (!boardElement) {
        return;
    }


    const up = {

        noLeft: "2",
        noRight: "1",

        title:
            "上り　取手方面",

        direction:
            "up",

        trains:
            getNextTrains(trainsUp)
    };


    const down = {

        noLeft: "4",
        noRight: "3",

        title:
            "下り　守谷・水海道・下館方面",

        direction:
            "down",

        trains:
            getNextTrains(trainsDown)
    };


    /*
     * 案内スクロール中は
     * 毎秒DOMを作り直さない。
     */
    const scrolling =
        boardElement.querySelector(
            ".row.arrival.scroll"
        );


    const approaching =
        boardElement.querySelector(
            ".row.arrival.blink"
        );


    if (
        scrolling &&
        showGuideSecondRow &&
        !approaching
    ) {
        return;
    }


    if (window.innerWidth >= 1250) {

        boardElement.innerHTML = `
            <div>
                ${renderBlock(down)}
            </div>

            <div>
                ${renderBlock(up)}
            </div>
        `;

    } else {

        boardElement.innerHTML = `
            <div>
                ${renderBlock(up)}
            </div>

            <div>
                ${renderBlock(down)}
            </div>
        `;
    }
}


/* =========================================================
   13. 現在時刻
========================================================= */

function updateTime() {

    const now =
        new Date();

    const element =
        $("#now");

    if (!element) {
        return;
    }


    element.textContent =
        `${String(now.getHours()).padStart(2, "0")}:` +
        `${String(now.getMinutes()).padStart(2, "0")}`;
}


/* =========================================================
   14. 日付情報
========================================================= */

function updateDateInfo() {

    /*
     * 元コードではHTMLに存在しない
     * #todayDate / #dayTypeを参照していたので、
     * 存在する場合だけ更新する。
     */

    const now =
        new Date();

    const dateElement =
        $("#todayDate");

    const typeElement =
        $("#dayType");


    if (dateElement) {

        const year =
            now.getFullYear();

        const month =
            String(now.getMonth() + 1)
                .padStart(2, "0");

        const day =
            String(now.getDate())
                .padStart(2, "0");

        dateElement.textContent =
            `${year}年${month}月${day}日`;
    }


    if (typeElement) {

        typeElement.textContent =
            getAutomaticDayType() === "holiday"
                ? "休日ダイヤ"
                : "平日ダイヤ";
    }
}


/* =========================================================
   15. 遅延設定
========================================================= */

function addDelay() {

    const trainNo =
        $("#delayTrainNo")?.value.trim();

    const minutes =
        Number.parseInt(
            $("#delayMinutes")?.value,
            10
        );


    if (
        !trainNo ||
        Number.isNaN(minutes) ||
        minutes < 0
    ) {

        alert(
            "列車番号と遅延時間を正しく入力してください"
        );

        return;
    }


    delays[trainNo] =
        minutes;


    alert(
        `${trainNo}列車に${minutes}分の遅延を設定しました`
    );


    const scrolling =
        document.querySelector(
            ".row.arrival.scroll"
        );


    if (!scrolling) {
        updateBoard();
    }
}


/* =========================================================
   16. ダイヤ切替ボタン
========================================================= */

function setActiveButton(activeId) {

    [
        "btnAuto",
        "btnWeekday",
        "btnHoliday"
    ].forEach(id => {

        const button =
            document.getElementById(id);

        if (!button) {
            return;
        }

        button.classList.toggle(
            "active",
            id === activeId
        );
    });
}


function updateTimetableStatus() {

    const element =
        $("#timetableStatus");

    if (!element) {
        return;
    }


    if (manualDayType === "weekday") {

        element.textContent =
            "【平日ダイヤ 手動指定】";

        setActiveButton(
            "btnWeekday"
        );

    } else if (
        manualDayType === "holiday"
    ) {

        element.textContent =
            "【休日ダイヤ 手動指定】";

        setActiveButton(
            "btnHoliday"
        );

    } else {

        element.textContent =
            "【自動切替中】";

        setActiveButton(
            "btnAuto"
        );
    }
}


/* =========================================================
   17. ダイヤ切替
========================================================= */

function selectDayType(type) {

    manualDayType =
        type;

    /*
     * 強制的に再読み込み
     */
    currentDayType = "";

    loadTimetableByDayType();
}


/* =========================================================
   18. イベント
========================================================= */

$("#addDelay")?.addEventListener(
    "click",
    addDelay
);


$("#btnAuto")?.addEventListener(
    "click",
    () => {

        manualDayType =
            null;

        currentDayType =
            "";

        loadTimetableByDayType();
    }
);


$("#btnWeekday")?.addEventListener(
    "click",
    () => {

        selectDayType(
            "weekday"
        );
    }
);


$("#btnHoliday")?.addEventListener(
    "click",
    () => {

        selectDayType(
            "holiday"
        );
    }
);


$("#mobileScreenButton")?.addEventListener(
    "click",
    () => {

        window.open(
            "https://kantetsu-moba.jp/",
            "_blank",
            "noopener,noreferrer"
        );
    }
);


/* =========================================================
   19. 初期化
========================================================= */

function initializeApp() {

    loadTimetableByDayType();

    updateTime();
    updateDateInfo();

    updateBoard();
    updateTimetableStatus();
}


/* =========================================================
   20. 定期更新
========================================================= */


/*
 * 時計
 */
setInterval(
    updateTime,
    1000
);


/*
 * ダイヤ自動切替
 */
setInterval(
    loadTimetableByDayType,
    60 * 1000
);


/*
 * 日付表示
 */
setInterval(
    updateDateInfo,
    60 * 1000
);


/*
 * 案内表示
 */
setInterval(
    showGuideOnce,
    30 * 1000
);


/*
 * 遅延表示切替
 */
setInterval(
    () => {

        showDelayNormal =
            !showDelayNormal;

        updateBoard();

    },
    30 * 1000
);


/*
 * 日本語 / 英語切替
 */
setInterval(
    () => {

        lang =
            lang === "ja"
                ? "en"
                : "ja";

        updateBoard();

    },
    15 * 1000
);


/*
 * 画面サイズ変更
 */
window.addEventListener(
    "resize",
    updateBoard
);


/*
 * 起動
 */
initializeApp();
