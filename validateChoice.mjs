// "middleware: skjekker om spiller imput er tilatt"


const normalize = (value) => {
    if (typeof value !== "string") return null;
    const choice = value.trim().toLowerCase();

// gjør om norsk til engelsk

if (choice === "stein") return "rock";
if (choice === "saks") return "scissors";
if (choice === "papir") return "paper"

return choice;

};

export function validateChoice(request, response, next){
    const { playerChoice } = request.body ?? {};

    if (playerChoice === undefined){
        return response.status(400).json({
            error: "Missing field: playerChoice",
            allowed: ["rock", "paper", "scissors"],
        });
    }


const normalized = normalize(playerChoice);

// hvis det er på norsk, normalize() returner engelsk
// om det allerede er engelsk normalize() returner engelsk

if (!normalized || !["rock", "paper", "scissors"].includes(normalized)) {
    return response.status(400).json({
        error: "invalid playerChoice",
        allowed: ["rock", "paper", "scissors"],
        received: playerChoice, 
    });

} 


// putt normalisert valg tilbake på requestuest for downstream handlers

request.body.playerChoice = normalized;
next();

}




