interface rewardsPerType {
    bronze: number;
    silver: number;
    gold: number;
}
export function determineChestRewards(chestType: string) {
    const rewardsPerType: rewardsPerType = {
        bronze: 2,
        silver: 4,
        gold: 6,
    };
    const goldRewardEarned = false;
    for (let i = 0; i < rewardsPerType[chestType as keyof rewardsPerType]; i++) {
        switch (chestType) {
            case "bronze": {
                const randomNum = Math.random();
                if (randomNum < 0.9) {
                    // common item
                } else {
                    // epic item
                }
            }
            // const randomNum = Math.random();
            // if (randomNum < 0.9) {
            //     // common item
            // } else if (randomNum < 0.95) {
            //     // rare item
            // } else {
            //     // epic item
            // }
        }
    }
}
