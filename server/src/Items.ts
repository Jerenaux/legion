import { Item, Stat, Target } from "./Item";

export const items:Item[] = [];

items[0] = new Item(0, "Potion", "Restores 50 HP", "potion.png", "healing", "potion_heal", 2, Target.SELF, [{stat: Stat.HP, value: 50}]);
items[1] = new Item(1, "Ether", "Restores 10 MP", "ether.png","healing", "potion_heal", 3, Target.SELF, [{stat: Stat.MP, value: 10}]);
items[2] = new Item(2, "Hi-Potion", "Restores 250 HP", "hi-potion.png", "healing","potion_heal", 4, Target.SELF, [{stat: Stat.HP, value: 250}]);
items[3] = new Item(3, "Hi-Ether", "Restores 50 MP", "hi-ether.png","healing", "potion_heal", 6, Target.SELF, [{stat: Stat.MP, value: 50}]);
items[4] = new Item(4, "X-Potion", "Restores 1000 HP", "X-potion.png", "healing", "potion_heal", 8, Target.SELF, [{stat: Stat.HP, value: 1000}]);
items[5] = new Item(5, "X-Ether", "Restores 200 MP", "X-ether.png", "healing", "potion_heal", 12, Target.SELF, [{stat: Stat.MP, value: 200}]);
items[6] = new Item(6, "Elixir", "Restores 250 HP and 50 MP", "elixir.png", "healing", "potion_heal", 12, Target.SELF, [{stat: Stat.HP, value: 250}, {stat: Stat.MP, value: 50}]);
items[7] = new Item(7, "X-Elixir", "Restores 1000 HP and 200 MP", "megalixir.png", "healing", "potion_heal", 22, Target.SELF, [{stat: Stat.HP, value: 1000}, {stat: Stat.MP, value: 200}]);
items[8] = new Item(8, "Clover", "Revives a KO ally", "clover.png", "healing", "potion_heal", 20, Target.SINGLE, [{stat: Stat.HP, value: 10, onKO: true}]);
items[9] = new Item(9, "Concoction", "Fully restores HP and MP", "concoction.png", "healing", "potion_heal", 40, Target.SELF, [{stat: Stat.HP, value: -1}, {stat: Stat.MP, value: -1}]);

