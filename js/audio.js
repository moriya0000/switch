/* =========================================================
   関鉄発車標
   音声システム
========================================================= */


/* =========================================================
   1. Audio
========================================================= */

const upSound =
    new Audio("./up.mp3");

const downSound =
    new Audio("./dw.mp3");

const upJingle =
    new Audio("./uj.mp3");

const downJingle =
    new Audio("./dj.mp3");

const mel =
    new Audio("./mel.mp3");

const cls =
    new Audio("./cls.mp3");


const audioList = [
    upSound,
    downSound,
    upJingle,
    downJingle,
    mel,
    cls
];


/* =========================================================
   2. 初期設定
========================================================= */

audioList.forEach(audio => {

    audio.preload = "auto";

    audio.addEventListener(
        "error",
        () => {

            console.error(
                "[音声ファイルエラー]",
                audio.src,
                audio.error
            );

            updateAudioDebug();
        }
    );

    audio.addEventListener(
        "loadeddata",
        () => {

            console.log(
                "[音声読み込み完了]",
                audio.src
            );

            updateAudioDebug();
        }
    );

    audio.load();
});


upSound.loop = true;
downSound.loop = true;
mel.loop = true;


/* =========================================================
   3. 状態
========================================================= */

let audioEnabled = false;

let wasUpApproaching = false;
let wasDownApproaching = false;

let upJinglePlaying = false;
let downJinglePlaying = false;

let audioCheckRunning = false;


/* =========================================================
   4. DOM
========================================================= */

const audioButton =
    document.getElementById(
        "enableAudioButton"
    );

const audioStatus =
    document.getElementById(
        "audioStatus"
    );

const audioDebug =
    document.getElementById(
        "audioDebug"
    );


/* =========================================================
   5. デバッグ
========================================================= */

function getAudioState(audio) {

    if (!audio) {
        return "存在しません";
    }

    if (audio.error) {

        return (
            `ERROR ${audio.error.code}`
        );
    }

    if (audio.ended) {
        return "終了";
    }

    if (audio.paused) {
        return "停止中";
    }

    return "再生中";
}


function getAudioTime(audio) {

    if (!audio) {
        return "----";
    }

    return Number.isFinite(
        audio.currentTime
    )
        ? audio.currentTime.toFixed(2)
        : "----";
}


function updateAudioDebug() {

    if (!audioDebug) {
        return;
    }


    audioDebug.textContent = `
===== 音声デバッグ =====

音声有効:
${audioEnabled ? "YES" : "NO"}

--------------------------------

up.mp3
状態: ${getAudioState(upSound)}
時間: ${getAudioTime(upSound)}
readyState: ${upSound.readyState}

dw.mp3
状態: ${getAudioState(downSound)}
時間: ${getAudioTime(downSound)}
readyState: ${downSound.readyState}

uj.mp3
状態: ${getAudioState(upJingle)}
時間: ${getAudioTime(upJingle)}
readyState: ${upJingle.readyState}

dj.mp3
状態: ${getAudioState(downJingle)}
時間: ${getAudioTime(downJingle)}
readyState: ${downJingle.readyState}

mel.mp3
状態: ${getAudioState(mel)}
時間: ${getAudioTime(mel)}
readyState: ${mel.readyState}

cls.mp3
状態: ${getAudioState(cls)}
時間: ${getAudioTime(cls)}
readyState: ${cls.readyState}

--------------------------------

上り接近:
${wasUpApproaching ? "YES" : "NO"}

下り接近:
${wasDownApproaching ? "YES" : "NO"}

上りジングル:
${upJinglePlaying ? "PLAYING" : "STOP"}

下りジングル:
${downJinglePlaying ? "PLAYING" : "STOP"}
`;
}


/* =========================================================
   6. 安全停止
========================================================= */

function safeStop(audio) {

    if (!audio) {
        return;
    }

    try {

        audio.pause();
        audio.currentTime = 0;

    } catch (error) {

        console.warn(
            "[音声停止エラー]",
            error
        );
    }
}


/* =========================================================
   7. 安全再生
========================================================= */

async function safePlay(
    audio,
    name
) {

    if (!audioEnabled) {
        return false;
    }

    if (!audio) {
        return false;
    }

    try {

        await audio.play();

        updateAudioDebug();

        return true;

    } catch (error) {

        console.error(
            `[音声再生失敗] ${name}`,
            error
        );

        updateAudioDebug();

        return false;
    }
}


/* =========================================================
   8. 音声有効化
========================================================= */

async function enableAudio() {

    if (audioEnabled) {
        updateAudioDebug();
        return true;
    }


    let successCount = 0;


    /*
     * ユーザー操作中に一度だけ
     * 全音声を再生してSafariの制限を解除
     */
    for (const audio of audioList) {

        try {

            audio.currentTime = 0;

            await audio.play();

            audio.pause();

            audio.currentTime = 0;

            successCount++;

        } catch (error) {

            console.warn(
                "[音声初期化失敗]",
                audio.src,
                error
            );
        }
    }


    audioEnabled =
        successCount > 0;


    if (audioEnabled) {

        audioButton?.classList.add(
            "is-enabled"
        );

        if (audioButton) {
            audioButton.textContent =
                "🔊 音声有効";
        }

        audioStatus?.classList.add(
            "is-enabled"
        );

        audioStatus?.classList.remove(
            "is-error"
        );

        if (audioStatus) {
            audioStatus.textContent =
                "音声は有効です。接近放送などが自動再生されます。";
        }

    } else {

        audioButton?.classList.remove(
            "is-enabled"
        );

        if (audioButton) {
            audioButton.textContent =
                "🔊 音声を有効にする";
        }

        audioStatus?.classList.remove(
            "is-enabled"
        );

        audioStatus?.classList.add(
            "is-error"
        );

        if (audioStatus) {
            audioStatus.textContent =
                "音声を有効化できませんでした。もう一度タップしてください。";
        }
    }


    updateAudioDebug();

    return audioEnabled;
}


audioButton?.addEventListener(
    "click",
    enableAudio
);


/* =========================================================
   9. ジングル
========================================================= */

async function playJingle(
    audio,
    name,
    direction
) {

    if (!audioEnabled) {
        return false;
    }


    if (
        direction === "up" &&
        upJinglePlaying
    ) {
        return false;
    }


    if (
        direction === "down" &&
        downJinglePlaying
    ) {
        return false;
    }


    if (direction === "up") {
        upJinglePlaying = true;
    } else {
        downJinglePlaying = true;
    }


    audio.onended = () => {

        if (direction === "up") {
            upJinglePlaying = false;
        } else {
            downJinglePlaying = false;
        }

        updateAudioDebug();
    };


    try {

        audio.pause();
        audio.currentTime = 0;

        await audio.play();

        updateAudioDebug();

        return true;

    } catch (error) {

        console.error(
            `[ジングル再生失敗] ${name}`,
            error
        );


        if (direction === "up") {
            upJinglePlaying = false;
        } else {
            downJinglePlaying = false;
        }


        updateAudioDebug();

        return false;
    }
}


/* =========================================================
   10. 接近放送
========================================================= */

async function handleApproach(
    approaching,
    previousState,
    sound,
    jingle,
    direction,
    soundName,
    jingleName
) {

    /*
     * 接近開始
     */
    if (
        approaching &&
        !previousState
    ) {

        safeStop(jingle);


        if (direction === "up") {
            upJinglePlaying = false;
        } else {
            downJinglePlaying = false;
        }


        if (audioEnabled) {

            safeStop(sound);

            await safePlay(
                sound,
                soundName
            );
        }
    }


    /*
     * 接近中
     */
    if (
        approaching &&
        audioEnabled &&
        sound.paused
    ) {

        await safePlay(
            sound,
            soundName
        );
    }


    /*
     * 接近終了
     */
    if (
        !approaching &&
        previousState
    ) {

        safeStop(sound);

        await playJingle(
            jingle,
            jingleName,
            direction
        );
    }


    return approaching;
}


/* =========================================================
   11. 接近状態チェック
========================================================= */

function checkApproachState() {

    const upTrains =
        getNextTrains(trainsUp);

    const downTrains =
        getNextTrains(trainsDown);


    const firstUp =
        upTrains[0];

    const firstDown =
        downTrains[0];


    return {

        upApproaching:
            firstUp
                ? isArrivingSoon(firstUp)
                : false,

        downApproaching:
            firstDown
                ? isArrivingSoon(firstDown)
                : false
    };
}


/* =========================================================
   12. 音声メイン処理
========================================================= */

async function updateApproachSound() {

    if (audioCheckRunning) {
        return;
    }

    audioCheckRunning = true;


    try {

        const state =
            checkApproachState();


        wasUpApproaching =
            await handleApproach(
                state.upApproaching,
                wasUpApproaching,
                upSound,
                upJingle,
                "up",
                "up.mp3",
                "uj.mp3"
            );


        wasDownApproaching =
            await handleApproach(
                state.downApproaching,
                wasDownApproaching,
                downSound,
                downJingle,
                "down",
                "dw.mp3",
                "dj.mp3"
            );


        updateAudioDebug();

    } catch (error) {

        console.error(
            "[音声メイン処理エラー]",
            error
        );

    } finally {

        audioCheckRunning = false;
    }
}


/* =========================================================
   13. 音声監視
========================================================= */

setInterval(
    updateApproachSound,
    500
);

setInterval(
    updateAudioDebug,
    500
);


/* =========================================================
   14. スイッチ操作
========================================================= */

document
    .querySelectorAll(".switch")
    .forEach(switchElement => {

        const onButton =
            switchElement.querySelector(
                ".on-button"
            );

        const offButton =
            switchElement.querySelector(
                ".off-button"
            );

        const status =
            switchElement.querySelector(
                ".status"
            );


        /*
         * ON
         */
        onButton?.addEventListener(
            "click",
            async () => {

                /*
                 * iPad / iPhone用
                 */
                if (!audioEnabled) {
                    await enableAudio();
                }


                /*
                 * 既にONなら何もしない
                 */
                if (
                    onButton.classList.contains(
                        "pressed"
                    )
                ) {
                    return;
                }


                onButton.classList.add(
                    "pressed"
                );

                switchElement.classList.add(
                    "is-on"
                );

                if (status) {
                    status.textContent =
                        "ON";
                }


                safeStop(cls);
                safeStop(mel);


                await safePlay(
                    mel,
                    "mel.mp3"
                );
            }
        );


        /*
         * OFF
         */
        offButton?.addEventListener(
            "click",
            async () => {

                const wasOn =
                    onButton.classList.contains(
                        "pressed"
                    );


                if (wasOn) {
                    safeStop(mel);
                }


                onButton.classList.remove(
                    "pressed"
                );

                switchElement.classList.remove(
                    "is-on"
                );


                if (status) {
                    status.textContent =
                        "OFF";
                }


                if (wasOn) {

                    safeStop(cls);

                    await safePlay(
                        cls,
                        "cls.mp3"
                    );
                }
            }
        );

    });


/* =========================================================
   15. 初期デバッグ
========================================================= */

updateAudioDebug();
