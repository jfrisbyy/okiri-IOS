import { ContentItem, Region, Difficulty, ContentCategory } from '@/types';
export { foundationLessons } from './foundationLessons';

export const frenchContent: ContentItem[] = [
  {
    id: '1',
    title: 'Au Café',
    subtitle: 'A simple dialogue at a French café',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'france',
    content: `— Bonjour ! Je voudrais un café, s'il vous plaît.

— Bien sûr. Un café noir ou un café crème ?

— Un café crème, merci. Et aussi un croissant.

— Très bien. C'est tout ?

— Oui, c'est tout. Combien ça coûte ?

— Quatre euros cinquante, s'il vous plaît.

— Voilà. Merci beaucoup !

— Merci à vous. Bonne journée !`,
  },
  {
    id: '2',
    title: 'Rencontre avec un ami',
    subtitle: 'Meeting a friend on the street',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    content: `— Salut Marie ! Comment vas-tu ?

— Ça va bien, merci ! Et toi, Pierre ?

— Très bien. Qu'est-ce que tu fais ce weekend ?

— Je vais au cinéma samedi soir. Tu veux venir ?

— Oui, avec plaisir ! On se retrouve où ?

— Devant le cinéma à vingt heures ?

— Parfait. À samedi alors !

— À samedi !`,
  },
  {
    id: '3',
    title: 'Le marché du dimanche',
    subtitle: 'A short article about French markets',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'article',
    region: 'france',
    content: `En France, le marché du dimanche est une tradition très importante. Chaque semaine, les Français aiment aller au marché pour acheter des fruits frais, des légumes de saison et du fromage local.

Le marché est aussi un lieu social. Les gens se rencontrent, discutent avec les vendeurs et prennent leur temps. On peut goûter les produits avant d'acheter.

Les marchés français sont célèbres pour leur qualité. On trouve des tomates parfaites en été, des pommes en automne, et toujours du pain frais. C'est une expérience authentique de la vie française.

Pour beaucoup de familles, le dimanche matin commence par une visite au marché, suivie d'un déjeuner en famille avec les produits achetés.`,
  },
  {
    id: '4',
    title: 'À la boulangerie',
    subtitle: 'Ordering at a French bakery',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    content: `— Bonjour madame !

— Bonjour ! Qu'est-ce que je vous sers ?

— Je voudrais une baguette, s'il vous plaît.

— Tradition ou classique ?

— Tradition, s'il vous plaît. Et deux pains au chocolat.

— Voilà. C'est pour manger maintenant ?

— Non, c'est pour emporter.

— Ça fait trois euros vingt.

— Voici. Merci, bonne journée !`,
  },
  {
    id: '5',
    title: 'Mon quartier',
    subtitle: 'A story about living in Paris',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'story',
    region: 'france',
    content: `J'habite dans un petit quartier de Paris, près du canal Saint-Martin. C'est un endroit très agréable, avec beaucoup de cafés et de restaurants.

Chaque matin, je descends acheter mon pain à la boulangerie du coin. La boulangère s'appelle Sophie. Elle connaît tous ses clients par leur prénom.

Le soir, j'aime me promener le long du canal. Les gens sont assis sur les bords, ils discutent, ils rient. Parfois, je m'arrête pour boire un verre avec des amis.

Mon quartier est calme mais vivant. Il y a toujours quelque chose à faire, quelqu'un à rencontrer. C'est pour ça que j'aime vivre ici.

Le weekend, le marché prend toute la rue. Les couleurs, les odeurs, les voix... C'est un spectacle magnifique.`,
  },
  {
    id: '6',
    title: 'Les transports à Paris',
    subtitle: 'Getting around the city',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'article',
    region: 'france',
    content: `Paris possède l'un des meilleurs systèmes de transport public au monde. Le métro, avec ses seize lignes, permet de traverser la ville rapidement. Plus de cinq millions de personnes l'utilisent chaque jour.

Pour prendre le métro, vous avez besoin d'un ticket ou d'un pass Navigo. Le pass est plus pratique si vous restez plusieurs jours. Vous pouvez l'acheter dans toutes les stations.

Les bus sont aussi très utiles, surtout pour voir la ville. Contrairement au métro, vous pouvez regarder par la fenêtre et découvrir les quartiers. Les arrêts sont annoncés à chaque fois.

Le vélo devient de plus en plus populaire. Le système Vélib' permet de louer un vélo pour quelques euros. C'est écologique et souvent plus rapide que le métro pour les petites distances.

Pour les longues distances, le RER connecte Paris à la banlieue. C'est le moyen le plus rapide pour aller à l'aéroport ou à Versailles.`,
  },
  {
    id: '7',
    title: 'Chez le médecin',
    subtitle: 'A visit to the doctor',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'france',
    tags: ['health', 'vocabulary', 'daily-life'],
    content: `— Bonjour docteur.

— Bonjour. Asseyez-vous. Qu'est-ce qui ne va pas ?

— J'ai mal à la tête depuis trois jours.

— Vous avez de la fièvre ?

— Oui, un peu. Trente-huit degrés.

— Je vais vous examiner. Ouvrez la bouche, s'il vous plaît.

— D'accord.

— Ce n'est pas grave. C'est un rhume. Je vous donne une ordonnance.

— Merci docteur. Je dois prendre les médicaments combien de fois par jour ?

— Trois fois par jour, pendant cinq jours.

— Très bien. Au revoir.`,
  },
  {
    id: '8',
    title: 'Ma famille',
    subtitle: 'Talking about family members',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'story',
    region: 'france',
    tags: ['family', 'vocabulary', 'introduction'],
    content: `Je m'appelle Lucas. J'ai une petite famille.

Mon père s'appelle Marc. Il a cinquante ans. Il est professeur.

Ma mère s'appelle Claire. Elle a quarante-huit ans. Elle travaille dans un hôpital.

J'ai une sœur. Elle s'appelle Emma. Elle a vingt ans. Elle est étudiante.

Nous avons un chat. Il s'appelle Minou. Il est gris et blanc.

Le dimanche, nous mangeons ensemble. C'est notre tradition familiale.`,
  },
  {
    id: '9',
    title: 'Le Carnaval de Martinique',
    subtitle: 'The famous Martinique Carnival celebration',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'culture',
    region: 'martinique',
    tags: ['carnival', 'traditions', 'music', 'celebration'],
    content: `Le Carnaval de Martinique est l'une des fêtes les plus importantes de l'île. Il commence en janvier et se termine le mercredi des Cendres.

Pendant le Carnaval, les rues sont remplies de musique et de danse. Les gens portent des costumes colorés et des masques. Les groupes jouent du zouk et du biguine.

Le dimanche gras, on voit les « reines » du Carnaval. Elles portent de magnifiques robes traditionnelles. Le lundi, tout le monde s'habille en noir et blanc pour les « mariages burlesques ».

Le mardi gras est le jour des diables rouges. Les enfants et les adultes se peignent en rouge. C'est très impressionnant !

Le mercredi des Cendres, on brûle le roi Vaval. C'est la fin du Carnaval. Les gens pleurent et chantent. L'année prochaine, un nouveau Vaval sera créé.`,
  },
  {
    id: '10',
    title: 'La poutine québécoise',
    subtitle: 'Quebec\'s iconic comfort food',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'quebec',
    tags: ['cuisine', 'tradition', 'comfort-food'],
    content: `La poutine est le plat le plus célèbre du Québec. C'est simple mais délicieux : des frites, du fromage en grains et de la sauce brune.

Ce plat est né dans les années 1950 dans la région du Centre-du-Québec. Aujourd'hui, on le trouve partout au Canada.

Le secret d'une bonne poutine, c'est le fromage. Il doit être frais et faire « squick-squick » quand on le mâche. La sauce doit être chaude pour faire fondre le fromage légèrement.

Il existe maintenant beaucoup de variations. On peut ajouter du poulet, du bacon, des légumes ou même du homard ! Mais les puristes préfèrent la version classique.

Au Québec, la poutine n'est pas seulement un plat. C'est un symbole de la culture québécoise. Les gens en mangent après une soirée, pour le déjeuner ou quand ils ont besoin de réconfort.`,
  },
  {
    id: '11',
    title: 'Bonjour de Dakar',
    subtitle: 'A postcard from Senegal\'s capital',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'travel',
    region: 'senegal',
    tags: ['city', 'travel', 'introduction'],
    content: `Cher ami,

Je suis à Dakar depuis une semaine. C'est une ville magnifique !

Les gens sont très accueillants. Ils disent « Teranga » - c'est l'hospitalité sénégalaise. Tout le monde sourit et dit bonjour.

J'ai mangé du thiéboudiène hier. C'est du riz avec du poisson et des légumes. C'est délicieux !

Les marchés sont colorés et animés. On trouve des fruits, des tissus et de l'artisanat. J'ai acheté un joli bracelet.

La mer est belle. Les plages sont grandes. Les pêcheurs reviennent le soir avec leurs pirogues colorées.

Demain, je visite l'île de Gorée. C'est un lieu historique important.

À bientôt !
Marie`,
  },
  {
    id: '12',
    title: 'Une journée à Marrakech',
    subtitle: 'Exploring the Red City',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'travel',
    region: 'morocco',
    tags: ['city', 'culture', 'travel'],
    content: `Marrakech est une ville fascinante. On l'appelle la « ville rouge » à cause de la couleur de ses murs.

Le matin, je me promène dans la médina. Les ruelles sont étroites et pleines de vie. Les vendeurs appellent les touristes. « Regarde, regarde ! Très beau tapis ! »

La place Jemaa el-Fna est le cœur de la ville. Le jour, on voit des charmeurs de serpents et des vendeurs de jus d'orange. Le soir, la place se transforme en grand restaurant en plein air.

Dans les souks, on trouve de tout : des épices, des lampes, des chaussures en cuir. Il faut négocier les prix. C'est la tradition !

Pour le déjeuner, je mange un tagine. C'est un plat cuit lentement dans un pot en terre. Le poulet aux citrons confits est mon préféré.

L'après-midi, je visite les jardins de Majorelle. C'est calme et magnifique. Le bleu des bâtiments est unique.

Marrakech est bruyante, colorée et surprenante. C'est une expérience inoubliable.`,
  },
  {
    id: '13',
    title: 'Le gwo ka de Guadeloupe',
    subtitle: 'The traditional drum music of Guadeloupe',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'guadeloupe',
    tags: ['music', 'tradition', 'culture', 'drums'],
    content: `Le gwo ka est la musique traditionnelle de la Guadeloupe. Cette musique est née pendant l'esclavage, quand les Africains déportés ont gardé leurs traditions musicales.

Le mot « gwo ka » vient de « gros quart », le nom des tonneaux utilisés pour fabriquer les premiers tambours. Aujourd'hui, les tambours sont faits de bois et de peau de cabri.

Il existe sept rythmes de base dans le gwo ka : le léwòz, le kaladja, le graj, le menndé, le padjanbèl, le toumblak et le woulé. Chaque rythme correspond à une danse et à une occasion particulière.

Le léwòz est le plus important. C'est un rythme de combat et de résistance. Les danseurs font face au tambour et répondent à son appel. C'est un dialogue entre le musicien et le danseur.

Depuis 2014, le gwo ka est inscrit au patrimoine culturel immatériel de l'UNESCO. C'est une reconnaissance mondiale de cette tradition guadeloupéenne.

Aujourd'hui, de nombreux artistes modernisent le gwo ka en le mélangeant avec du jazz, du reggae ou de la musique électronique. Mais les « léwòz » traditionnels continuent d'avoir lieu chaque samedi soir dans les villages.`,
  },
  {
    id: '14',
    title: 'La Tour Eiffel',
    subtitle: 'History of Paris\'s most famous monument',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'history',
    region: 'france',
    tags: ['monument', 'paris', 'history', 'architecture'],
    content: `La Tour Eiffel est le symbole de Paris et de la France. Elle a été construite par Gustave Eiffel pour l'Exposition universelle de 1889, qui célébrait le centenaire de la Révolution française.

Au début, beaucoup de Parisiens n'aimaient pas la tour. Des artistes et des écrivains ont signé une pétition contre cette « tour de fer ». Ils la trouvaient laide et pensaient qu'elle défigurait Paris.

La tour mesure 330 mètres de haut avec ses antennes. Elle était le bâtiment le plus haut du monde jusqu'en 1930, quand le Chrysler Building a été construit à New York.

Gustave Eiffel avait prévu que la tour serait démontée après vingt ans. Mais elle est devenue si populaire et si utile pour les communications radio qu'elle a été conservée.

Aujourd'hui, près de sept millions de personnes visitent la Tour Eiffel chaque année. On peut monter à pied ou en ascenseur. Du sommet, on voit tout Paris.

La nuit, la tour brille de milliers de lumières. Toutes les heures, elle scintille pendant cinq minutes. C'est un spectacle magique que les Parisiens et les touristes adorent.`,
  },
  {
    id: '15',
    title: 'À l\'hôtel',
    subtitle: 'Checking into a hotel',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    tags: ['hotel', 'travel', 'vocabulary'],
    content: `— Bonsoir. J'ai une réservation au nom de Dupont.

— Bonsoir monsieur. Un instant, s'il vous plaît... Oui, une chambre double pour trois nuits.

— C'est exact.

— Voici votre clé. C'est la chambre 215, au deuxième étage.

— L'ascenseur est où ?

— Au fond du couloir, à gauche.

— Le petit-déjeuner est inclus ?

— Oui, de sept heures à dix heures, au restaurant.

— Parfait. Merci beaucoup.

— Je vous en prie. Bon séjour !`,
  },
  {
    id: '16',
    title: 'L\'indépendance d\'Haïti',
    subtitle: 'The first free Black republic',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'history',
    region: 'haiti',
    tags: ['independence', 'revolution', 'Toussaint Louverture', 'slavery'],
    content: `L'indépendance d'Haïti, proclamée le 1er janvier 1804, représente un moment unique dans l'histoire mondiale. C'est la première révolution d'esclaves réussie et la création de la première république noire libre.

Avant la révolution, Saint-Domingue était la colonie française la plus riche des Caraïbes. Les plantations de sucre et de café rapportaient des fortunes énormes. Mais cette richesse reposait sur l'exploitation brutale de centaines de milliers d'esclaves africains.

La révolution a commencé en août 1791 avec la cérémonie du Bois Caïman. Selon la tradition, le prêtre vodou Boukman a organisé une réunion secrète où les esclaves ont juré de se libérer. Cette nuit-là, les plantations du nord ont été incendiées.

Toussaint Louverture est devenu le leader de la révolution. Ancien esclave devenu général, il était un stratège militaire brillant. Il a successivement combattu les Espagnols, les Anglais et les Français. Il a aboli l'esclavage et réorganisé l'économie de l'île.

En 1802, Napoléon Bonaparte a envoyé une armée de 40 000 soldats pour rétablir l'esclavage. Toussaint a été capturé par traîtrise et emprisonné en France, où il est mort en 1803.

Mais la résistance a continué sous Jean-Jacques Dessalines. La fièvre jaune a décimé l'armée française. Le 18 novembre 1803, à la bataille de Vertières, les Haïtiens ont remporté la victoire finale.

Le 1er janvier 1804, Dessalines a proclamé l'indépendance et donné au pays son nom taïno : Haïti, « terre des montagnes ». C'était un message au monde entier : les esclaves pouvaient se libérer et créer leur propre nation.`,
  },
  {
    id: '17',
    title: 'Les accras de morue',
    subtitle: 'Caribbean cod fritters recipe',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'martinique',
    tags: ['recipe', 'cuisine', 'Caribbean', 'appetizer'],
    content: `Les accras de morue sont l'apéritif préféré des Antilles. Ces petites beignets de poisson sont croustillants à l'extérieur et moelleux à l'intérieur.

Pour préparer les accras, il faut d'abord dessaler la morue. On la met dans l'eau pendant une nuit. Le lendemain, on change l'eau plusieurs fois.

Ensuite, on fait cuire la morue et on l'émiette. On enlève toutes les arêtes. Le poisson doit être en petits morceaux.

On prépare la pâte avec de la farine, de l'eau, un œuf et de la levure. On ajoute des oignons verts, du persil, de l'ail et du piment. Le piment est important ! Ça doit piquer un peu.

On mélange la morue avec la pâte. La consistance doit être épaisse mais pas trop.

On fait chauffer l'huile. Elle doit être bien chaude. On dépose des petites cuillères de pâte dans l'huile. Les accras gonflent et deviennent dorés.

On les sert chauds avec une sauce au citron vert ou une sauce chien. C'est parfait avec un ti-punch !`,
  },
  {
    id: '18',
    title: 'Le sirop d\'érable',
    subtitle: 'Quebec\'s liquid gold',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'culture',
    region: 'quebec',
    tags: ['tradition', 'food', 'nature', 'spring'],
    content: `Au Québec, le printemps arrive avec le temps des sucres. C'est la saison de la récolte du sirop d'érable, une tradition qui remonte aux peuples autochtones.

Les Amérindiens avaient découvert que la sève des érables était sucrée. Ils faisaient des entailles dans l'écorce et recueillaient le liquide qui coulait. Les premiers colons français ont appris cette technique et l'ont perfectionnée.

Aujourd'hui, le Québec produit plus de 70% du sirop d'érable mondial. C'est une industrie importante, mais aussi une tradition culturelle vivante.

Le processus commence quand les nuits sont encore froides mais les journées se réchauffent. Cette alternance fait monter la sève dans les arbres. On installe des chalumeaux dans les troncs et on recueille l'eau d'érable.

Il faut environ 40 litres d'eau d'érable pour produire un seul litre de sirop. On fait bouillir l'eau pendant des heures dans la cabane à sucre jusqu'à ce qu'elle devienne du sirop doré.

Les cabanes à sucre sont aussi des lieux de fête. Les familles québécoises y vont pour manger des repas traditionnels : jambon, fèves au lard, oreilles de crisse et, bien sûr, de la tire sur la neige. C'est du sirop chaud versé sur la neige fraîche qui devient une friandise caramélisée.

Le sirop d'érable est devenu un symbole du Québec, aussi important que la feuille d'érable sur le drapeau canadien.`,
  },
  {
    id: '19',
    title: 'Au supermarché',
    subtitle: 'Shopping for groceries',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    tags: ['shopping', 'vocabulary', 'daily-life'],
    content: `— Excusez-moi, où est le rayon des fruits ?

— C'est au fond du magasin, à droite.

— Merci. Et les produits laitiers ?

— Juste à côté, dans l'allée numéro 3.

— D'accord. Vous avez du lait sans lactose ?

— Oui, regardez sur l'étagère du bas.

— Parfait. Où sont les caisses ?

— Devant, près de l'entrée.

— Est-ce que je peux payer par carte ?

— Bien sûr, on accepte toutes les cartes.

— Merci beaucoup !`,
  },
  {
    id: '20',
    title: 'Youssou N\'Dour et la musique sénégalaise',
    subtitle: 'The voice of Senegal',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'music',
    region: 'senegal',
    tags: ['music', 'mbalax', 'culture', 'artist'],
    content: `Youssou N'Dour est l'artiste sénégalais le plus connu dans le monde. Sa voix puissante et son style unique ont fait de lui une légende de la musique africaine.

Né en 1959 à Dakar, Youssou a grandi dans le quartier populaire de la Médina. Sa mère était une griotte, une chanteuse traditionnelle. Il a commencé à chanter très jeune dans les cérémonies du quartier.

À l'âge de douze ans, il rejoint le Star Band de Dakar, le groupe le plus populaire du pays. En 1979, il fonde son propre groupe : le Super Étoile de Dakar.

Youssou N'Dour a créé un style musical appelé mbalax. C'est un mélange de rythmes traditionnels wolofs, de musique cubaine et de pop occidentale. Le sabar, un tambour traditionnel sénégalais, est au cœur de ce son unique.

Sa chanson « 7 Seconds » avec Neneh Cherry a été un succès mondial en 1994. Il a aussi chanté avec Peter Gabriel, Bruce Springsteen et de nombreux autres artistes internationaux.

Au-delà de la musique, Youssou N'Dour est engagé pour les causes humanitaires. Il a participé à des concerts pour l'Afrique et soutient l'éducation. En 2012, il est même entré en politique et a été ministre du Tourisme du Sénégal.

Pour beaucoup de Sénégalais, Youssou N'Dour représente la fierté nationale. Il a montré que la musique africaine peut conquérir le monde tout en restant authentique.`,
  },
  {
    id: '21',
    title: 'La Fête des Cuisinières',
    subtitle: 'Guadeloupe\'s unique culinary celebration',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'culture',
    region: 'guadeloupe',
    tags: ['festival', 'cuisine', 'tradition', 'women'],
    content: `Chaque année en août, Pointe-à-Pitre célèbre la Fête des Cuisinières. Cette tradition existe depuis 1916 et honore les femmes qui perpétuent la cuisine créole.

La fête commence par une messe à la cathédrale Saint-Pierre-et-Saint-Paul. Les cuisinières arrivent en procession, vêtues de leurs plus belles robes créoles. Elles portent des madras colorés et des bijoux traditionnels.

Chaque cuisinière porte un panier sur la tête. Ces paniers sont décorés et remplis des meilleurs produits : fruits tropicaux, légumes du jardin, épices et poissons. Ils seront bénis pendant la cérémonie.

Après la messe, un grand défilé traverse la ville. Les cuisinières dansent au rythme du gwo ka. Les spectateurs applaudissent et chantent.

Le point culminant est le repas traditionnel. Les cuisinières préparent les plats typiques de la Guadeloupe : colombo, boudin créole, matété de crabe. C'est un festin qui dure des heures.

La Fête des Cuisinières célèbre plus que la gastronomie. Elle honore les femmes guadeloupéennes qui ont préservé les traditions culinaires transmises de génération en génération. C'est une fête de la mémoire et de la fierté créole.`,
  },
  {
    id: '22',
    title: 'Le Ramadan au Maroc',
    subtitle: 'A month of spiritual observance',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'culture',
    region: 'morocco',
    tags: ['religion', 'tradition', 'spirituality', 'community'],
    content: `Le Ramadan est le mois le plus important du calendrier musulman. Au Maroc, c'est une période de profonde spiritualité mais aussi de traditions sociales et culinaires uniques.

Pendant ce mois, les musulmans jeûnent du lever au coucher du soleil. Ils ne mangent pas, ne boivent pas et évitent les mauvaises pensées. C'est un temps de purification de l'âme et du corps.

La vie quotidienne change complètement pendant le Ramadan. Les rythmes de travail sont modifiés. Les magasins ferment l'après-midi et rouvrent le soir. Les rues sont calmes pendant la journée.

Au coucher du soleil, le muezzin appelle à la prière. C'est l'heure de l'iftar, la rupture du jeûne. Traditionnellement, on commence par manger des dattes et boire du lait, comme le faisait le Prophète.

Le repas d'iftar marocain est riche et festif. On sert la harira, une soupe épaisse aux tomates, lentilles et pois chiches. Il y a aussi des chebakia, des gâteaux au miel et aux graines de sésame, et des briouates, des petits feuilletés farcis.

Les familles se réunissent chaque soir. Les voisins s'invitent mutuellement. Les mosquées sont pleines pour les prières nocturnes appelées tarawih.

Les dernières nuits du Ramadan sont particulièrement importantes. La vingt-septième nuit, Laylat al-Qadr, est considérée comme la plus sacrée de l'année.

Le Ramadan se termine par l'Aïd el-Fitr, une grande fête de trois jours. Les familles se retrouvent, les enfants reçoivent des cadeaux, et tout le monde porte de nouveaux vêtements.`,
  },
  {
    id: '23',
    title: 'Les gaufres belges',
    subtitle: 'Belgium\'s famous sweet treat',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'belgium',
    tags: ['cuisine', 'dessert', 'tradition'],
    content: `La Belgique est célèbre pour ses gaufres. On en trouve partout : dans les gares, les marchés et les restaurants.

Il existe deux types principaux de gaufres belges. La gaufre de Bruxelles est rectangulaire, légère et croustillante. On la mange avec de la crème chantilly, des fruits ou du chocolat.

La gaufre de Liège est différente. Elle est plus petite, plus dense et plus sucrée. La pâte contient des morceaux de sucre perlé qui caramélisent à la cuisson. On peut la manger nature, sans rien ajouter.

L'histoire des gaufres remonte au Moyen Âge. Les cuisiniers des abbayes les préparaient pour les fêtes religieuses. Le mot « gaufre » vient du mot germanique pour « gâteau de miel ».

Aujourd'hui, les touristes viennent en Belgique spécialement pour goûter les gaufres. À Bruxelles, les boutiques de gaufres sont aussi nombreuses que les boutiques de chocolat.

Le secret d'une bonne gaufre ? Une pâte fraîche, un gaufrier bien chaud et un peu de beurre. Et surtout, la manger chaude, juste sortie du gaufrier !`,
  },
  {
    id: '24',
    title: 'Le créole haïtien',
    subtitle: 'Haiti\'s unique language',
    difficulty: 'hard',
    estimatedMinutes: 9,
    category: 'culture',
    region: 'haiti',
    tags: ['language', 'creole', 'identity', 'linguistics'],
    content: `Le créole haïtien, ou kreyòl, est la langue maternelle de plus de dix millions d'Haïtiens. C'est l'une des langues créoles les plus importantes du monde.

Le créole haïtien est né pendant la période coloniale. Les esclaves venus de différentes régions d'Afrique devaient communiquer entre eux et avec les colons français. Ils ont créé une nouvelle langue à partir du français, mais avec des structures grammaticales africaines.

Pendant longtemps, le créole était considéré comme un « patois », une langue inférieure. Seul le français était utilisé à l'école, dans l'administration et dans les affaires. Mais la majorité des Haïtiens ne parlaient que créole.

En 1987, la nouvelle constitution haïtienne a reconnu le créole comme langue officielle, au même titre que le français. C'était une victoire pour les défenseurs de la culture populaire.

Aujourd'hui, le créole haïtien a sa propre littérature, sa poésie et sa musique. Des écrivains comme Frankétienne ont créé des œuvres majeures en créole. Le théâtre créole est très populaire.

La langue continue d'évoluer. Les jeunes créent de nouveaux mots, mélangent le créole avec l'anglais américain. Dans la diaspora, le créole se transforme au contact d'autres langues.

Pour les Haïtiens, le créole est plus qu'une langue. C'est le symbole de leur identité, de leur résistance et de leur créativité. Comme dit le proverbe haïtien : « Pale kreyòl, se pale ak kè ou » - parler créole, c'est parler avec son cœur.`,
  },
  {
    id: '25',
    title: 'Le chocolat suisse',
    subtitle: 'Switzerland\'s sweet tradition',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'switzerland',
    tags: ['chocolate', 'cuisine', 'tradition', 'industry'],
    content: `La Suisse est le pays du chocolat. Les Suisses mangent environ 10 kilos de chocolat par personne chaque année. C'est un record mondial !

Pourtant, le cacao ne pousse pas en Suisse. Le pays a appris à transformer le chocolat mieux que personne.

En 1875, Daniel Peter a inventé le chocolat au lait à Vevey. Il a eu l'idée d'ajouter du lait en poudre au chocolat. Son voisin, Henri Nestlé, lui a fourni le lait condensé nécessaire.

Un autre Suisse, Rodolphe Lindt, a inventé le conchage. C'est une technique qui rend le chocolat plus lisse et plus fondant. Avant cela, le chocolat était granuleux.

Aujourd'hui, les grandes marques suisses sont connues dans le monde entier : Lindt, Toblerone, Cailler, Frey. Chaque Suisse a sa marque préférée.

Visiter une chocolaterie suisse est une expérience gourmande. On découvre l'histoire du chocolat, on voit les machines et, bien sûr, on goûte beaucoup de chocolat.

Le chocolat suisse reste un symbole de qualité et de précision, comme les montres et les banques du pays.`,
  },
  {
    id: '26',
    title: 'Le mont Pelée',
    subtitle: 'Martinique\'s volcano and the 1902 disaster',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'history',
    region: 'martinique',
    tags: ['volcano', 'disaster', 'history', 'nature'],
    content: `Le mont Pelée domine le nord de la Martinique. Ce volcan de 1 397 mètres est célèbre dans le monde entier pour l'éruption catastrophique du 8 mai 1902.

Avant cette date, Saint-Pierre était la ville la plus importante de la Martinique. On l'appelait le « Paris des Antilles ». C'était un port prospère de 28 000 habitants, avec des théâtres, des journaux et une vie culturelle intense.

Les premiers signes d'activité volcanique sont apparus en avril 1902. De la fumée sortait du cratère. Des cendres tombaient sur la ville. L'odeur de soufre était forte. Les animaux fuyaient la montagne.

Malgré ces avertissements, les autorités ont refusé d'évacuer la ville. Des élections importantes devaient avoir lieu le 11 mai. Le gouverneur lui-même est venu rassurer la population.

Le 8 mai à 7h52, une nuée ardente a dévalé le volcan. Ce nuage de gaz brûlants et de cendres, à plus de 400 degrés, a atteint la ville en moins de deux minutes. Saint-Pierre a été entièrement détruite.

Près de 30 000 personnes sont mortes en quelques instants. Il n'y a eu que deux survivants dans la ville. L'un d'eux, Louis-Auguste Cyparis, était en prison dans un cachot souterrain.

L'éruption de la montagne Pelée a marqué l'histoire de la volcanologie. Elle a donné son nom à un type d'éruption : l'éruption « péléenne ». Les scientifiques du monde entier sont venus étudier le volcan.

Aujourd'hui, Saint-Pierre est une petite ville tranquille. Les ruines de l'ancienne ville sont visibles partout. Un musée raconte l'histoire de la catastrophe. Le volcan reste surveillé en permanence.`,
  },
  {
    id: '27',
    title: 'Le zouglou ivoirien',
    subtitle: 'The voice of youth in Ivory Coast',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'ivory-coast',
    tags: ['music', 'youth', 'culture', 'social'],
    content: `Le zouglou est un genre musical né dans les cités universitaires d'Abidjan à la fin des années 1980. C'est la musique de la jeunesse ivoirienne.

À l'origine, le zouglou était la musique des étudiants pauvres. Ils n'avaient pas d'instruments sophistiqués, alors ils chantaient en frappant sur des tables et des bidons. Les paroles parlaient de leurs problèmes quotidiens.

Le mot « zouglou » viendrait d'une danse populaire des quartiers défavorisés. C'est une musique qui vient de la rue, du peuple, des gens ordinaires.

Les premiers grands groupes de zouglou sont apparus dans les années 1990 : les Potes de la Rue, Espoir 2000, Magic System. Leurs chansons parlaient de la vie difficile, du chômage, de la corruption, mais aussi de l'amour et de l'espoir.

Magic System a fait connaître le zouglou dans le monde entier avec « Premier Gaou » en 2003. Cette chanson a été un succès en Afrique et en Europe.

Le zouglou se caractérise par des rythmes entraînants et des paroles en français mélangé au nouchi, l'argot d'Abidjan. Les chanteurs racontent des histoires de la vie quotidienne avec humour et ironie.

Aujourd'hui, le zouglou reste populaire en Côte d'Ivoire. C'est plus qu'une musique : c'est une façon de parler des problèmes de la société tout en faisant danser les gens.`,
  },
  {
    id: '28',
    title: 'Demander son chemin',
    subtitle: 'Asking for directions',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'france',
    tags: ['directions', 'travel', 'vocabulary'],
    content: `— Excusez-moi, je cherche la gare, s'il vous plaît.

— La gare ? Oui, ce n'est pas loin. Continuez tout droit.

— D'accord.

— Au feu rouge, tournez à gauche. Puis prenez la deuxième rue à droite.

— Tout droit, à gauche au feu, deuxième à droite.

— C'est ça. La gare est au bout de la rue.

— C'est loin à pied ?

— Non, c'est à cinq minutes.

— Merci beaucoup !

— De rien. Bonne journée !`,
  },
  {
    id: '29',
    title: 'L\'île de Gorée',
    subtitle: 'A place of memory in Senegal',
    difficulty: 'hard',
    estimatedMinutes: 9,
    category: 'history',
    region: 'senegal',
    tags: ['slavery', 'memory', 'history', 'UNESCO'],
    content: `L'île de Gorée, située au large de Dakar, est l'un des lieux de mémoire les plus importants de l'histoire de l'esclavage. Cette petite île de 28 hectares accueille des visiteurs du monde entier.

Pendant plus de trois siècles, Gorée a été un centre du commerce des esclaves. Les Portugais, puis les Hollandais, les Anglais et enfin les Français ont contrôlé l'île successivement.

La Maison des Esclaves, construite en 1776, est le symbole de cette histoire douloureuse. Les captifs africains étaient parqués dans des cellules minuscules avant d'être embarqués vers les Amériques. La « porte du voyage sans retour » donnait directement sur l'océan.

Les historiens débattent du nombre exact de captifs passés par Gorée. Certains estiment que l'île n'était pas un centre majeur de la traite. Mais sa valeur symbolique reste immense.

En 1978, Gorée a été inscrite au patrimoine mondial de l'UNESCO. L'île est devenue un lieu de pèlerinage pour la diaspora africaine. Des personnalités comme Nelson Mandela, le pape Jean-Paul II et Barack Obama l'ont visitée.

Aujourd'hui, Gorée est une île paisible aux maisons colorées. Des artistes y vivent et y travaillent. Les ruelles pavées et les bougainvilliers en fleurs contrastent avec le passé tragique du lieu.

La visite de Gorée est une expérience émouvante. Elle invite à réfléchir sur les crimes de l'histoire et sur la résilience des peuples africains. Comme l'a dit le premier président sénégalais Léopold Sédar Senghor : « Gorée est le témoin de la barbarie humaine, mais aussi de la capacité de l'homme à dépasser cette barbarie. »`,
  },
  {
    id: '30',
    title: 'Au restaurant',
    subtitle: 'Ordering a meal',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'france',
    tags: ['restaurant', 'food', 'vocabulary'],
    content: `— Bonsoir, une table pour deux, s'il vous plaît.

— Bonsoir. Oui, suivez-moi. Voici le menu.

— Merci. Quel est le plat du jour ?

— C'est du poulet rôti avec des légumes.

— Je prends le plat du jour, alors.

— Et pour vous, madame ?

— Je voudrais une salade et le poisson.

— Très bien. Et comme boisson ?

— Une carafe d'eau, s'il vous plaît.

— C'est noté. Je vous apporte ça tout de suite.

[Plus tard]

— L'addition, s'il vous plaît.

— Voilà. Ça fait trente-deux euros.

— Merci. Voici. C'était délicieux !`,
  },
  {
    id: '31',
    title: 'Le makossa camerounais',
    subtitle: 'Cameroon\'s dance music',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'cameroon',
    tags: ['music', 'dance', 'culture', 'Manu Dibango'],
    content: `Le makossa est né à Douala, la capitale économique du Cameroun, dans les années 1960. Ce style musical énergique a fait danser l'Afrique et le monde entier.

Le mot « makossa » vient de la langue douala et signifie « danse ». À l'origine, c'était la musique des fêtes et des célébrations du peuple Sawa, qui vit sur la côte camerounaise.

Manu Dibango a fait connaître le makossa internationalement avec « Soul Makossa » en 1972. Ce morceau a été un succès mondial et a influencé de nombreux artistes, dont Michael Jackson, qui a repris certains éléments dans « Wanna Be Startin' Somethin' ».

Le makossa se caractérise par une ligne de basse très présente, des cuivres puissants et un rythme qui donne envie de danser. Les paroles sont souvent en douala, en français ou dans d'autres langues camerounaises.

D'autres artistes ont marqué l'histoire du makossa : Eboa Lotin, Lapiro de Mbanga, Petit-Pays. Chacun a apporté sa touche personnelle tout en respectant les fondements du genre.

Aujourd'hui, le makossa continue d'évoluer. Les jeunes artistes le mélangent avec l'afrobeats, le hip-hop et l'électro. Mais dans les fêtes de Douala, on danse toujours sur les classiques des années 70 et 80.

Le makossa reste un symbole de l'identité camerounaise et de la capacité de l'Afrique à créer des musiques qui traversent les frontières.`,
  },
  {
    id: '32',
    title: 'Les expressions québécoises',
    subtitle: 'Understanding Quebec French',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'culture',
    region: 'quebec',
    tags: ['language', 'expressions', 'vocabulary'],
    content: `Le français du Québec est différent du français de France. Voici quelques expressions à connaître.

« Char » signifie voiture. « J'ai acheté un nouveau char. » Les Québécois utilisent beaucoup de mots anglais francisés.

« Blonde » veut dire petite amie. « C'est ma blonde. » Pour le petit ami, on dit « chum ».

« Pogner » signifie attraper ou comprendre. « As-tu pogné le bus ? » ou « Je ne pogne pas ce qu'il dit. »

« Pantoute » veut dire « pas du tout ». « T'es fatigué ? — Pantoute ! » C'est une expression très québécoise.

« Magasiner » signifie faire du shopping. « On va magasiner au centre d'achat. »

« Dépanneur » est un petit magasin de quartier ouvert tard. « Je vais au dépanneur chercher du lait. »

« Tabarnac » est un juron québécois très fort. Il vient du mot « tabernacle ». À éviter dans les situations polies !

Ces expressions font partie de l'identité québécoise. Les Québécois sont fiers de leur façon de parler le français.`,
  },
  {
    id: '33',
    title: 'Tintin en Belgique',
    subtitle: 'Belgium\'s beloved comic character',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'culture',
    region: 'belgium',
    tags: ['comics', 'art', 'Hergé', 'literature'],
    content: `Tintin est le personnage de bande dessinée le plus célèbre de Belgique. Ce jeune reporter avec sa houppette est connu dans le monde entier.

Tintin a été créé par Hergé, de son vrai nom Georges Remi. Le premier album, « Tintin au pays des Soviets », est paru en 1929. Depuis, plus de 250 millions d'albums ont été vendus.

Les aventures de Tintin se passent partout dans le monde : en Amérique, en Afrique, au Tibet, sur la Lune. Chaque album est une aventure différente avec de l'action, du mystère et de l'humour.

Les compagnons de Tintin sont aussi célèbres que lui. Milou est son fidèle chien blanc. Le capitaine Haddock est un marin qui jure beaucoup. Les Dupond et Dupont sont deux policiers maladroits. Le professeur Tournesol est un inventeur distrait.

Hergé avait un style de dessin très particulier, appelé « ligne claire ». Les dessins sont précis, les couleurs sont vives, les décors sont réalistes. Hergé faisait beaucoup de recherches pour dessiner les pays et les monuments.

À Bruxelles, on peut visiter le Musée Hergé et voir des fresques de Tintin sur les murs de la ville. Pour les Belges, Tintin est un trésor national, aussi important que le chocolat et les gaufres.`,
  },
  {
    id: '34',
    title: 'L\'art de la négociation au Maroc',
    subtitle: 'Bargaining in Moroccan souks',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'culture',
    region: 'morocco',
    tags: ['shopping', 'tradition', 'souks', 'travel'],
    content: `Dans les souks marocains, les prix ne sont pas fixes. Négocier fait partie de la culture et de l'expérience.

La première règle : le vendeur commence toujours très haut. Si vous acceptez le premier prix, il sera déçu ! La négociation est un jeu social.

Commencez par regarder sans montrer trop d'intérêt. Si vous semblez très enthousiaste, le prix montera. Restez calme et détaché.

Demandez le prix, puis proposez environ la moitié. Le vendeur refusera avec des gestes dramatiques. C'est normal. Continuez à négocier.

On finit généralement à un prix entre 50% et 70% du prix initial. Mais chaque situation est différente. Les objets touristiques se négocient plus que les produits du quotidien.

Buvez le thé à la menthe que vous offre le vendeur. C'est une tradition d'hospitalité. Mais attention : accepter le thé ne vous oblige pas à acheter.

Si vous n'arrivez pas à vous mettre d'accord, partez. Souvent, le vendeur vous rappellera avec un meilleur prix.

La négociation doit rester agréable. Souriez, parlez un peu arabe ou berbère si vous pouvez. Les vendeurs apprécient les clients qui jouent le jeu avec bonne humeur.`,
  },
  {
    id: '35',
    title: 'Le kompa haïtien',
    subtitle: 'Haiti\'s beloved dance music',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'haiti',
    tags: ['music', 'dance', 'culture', 'Nemours Jean-Baptiste'],
    content: `Le kompa, aussi écrit « compas », est la musique nationale d'Haïti. Créé dans les années 1950, ce rythme fait danser les Haïtiens du monde entier.

Nemours Jean-Baptiste est considéré comme le père du kompa. En 1955, il a créé ce nouveau style en modernisant le méringue haïtien traditionnel. Le rythme est plus lent, plus sensuel, parfait pour danser en couple.

Le kompa se caractérise par une basse profonde, des cuivres et des synthétiseurs. Le rythme « tanbou » donne son groove unique. Les chansons parlent généralement d'amour, de la vie quotidienne et de la nostalgie du pays.

Dans les années 1960 et 70, des groupes comme Tabou Combo et Les Difficiles ont exporté le kompa aux États-Unis et en Europe. La diaspora haïtienne a gardé cette musique vivante à l'étranger.

Aujourd'hui, des artistes comme Sweet Micky (qui est devenu président d'Haïti), Carimi et Klass continuent à faire évoluer le genre. Le kompa moderne incorpore des éléments de R&B et de hip-hop.

Dans toute fête haïtienne, le kompa est incontournable. Les couples se serrent et bougent lentement au rythme de la musique. C'est plus qu'une danse, c'est une expression de la joie de vivre haïtienne.`,
  },
  {
    id: '36',
    title: 'Les fromages français',
    subtitle: 'A journey through French cheese',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'food',
    region: 'france',
    tags: ['cheese', 'cuisine', 'tradition', 'regions'],
    content: `La France produit plus de 400 types de fromages différents. Comme disait le général de Gaulle : « Comment voulez-vous gouverner un pays qui a 246 variétés de fromages ? » En réalité, il y en a beaucoup plus !

Le camembert est peut-être le fromage français le plus connu. Il vient de Normandie et a une croûte blanche et molle. Son intérieur est crémeux et parfumé.

Le roquefort est un fromage bleu du sud de la France. Il est fabriqué avec du lait de brebis et affiné dans des caves naturelles. Son goût est fort et salé.

Le comté vient des montagnes du Jura. C'est un fromage à pâte dure, au goût de noisette. Chaque meule pèse environ 40 kilos et demande 400 litres de lait.

Le brie, appelé le « roi des fromages », est originaire de la région parisienne. Il est crémeux et doux, parfait pour terminer un repas.

Le chèvre existe sous des centaines de formes : frais ou sec, cendré ou nature, en bûche ou en pyramide. Chaque région a sa spécialité.

Les Français mangent le fromage après le plat principal, avant le dessert. On le sert sur un plateau avec du pain et souvent un verre de vin rouge.

Les marchés français sont le meilleur endroit pour découvrir les fromages locaux. Le fromager vous fera goûter et vous conseillera selon vos goûts.`,
  },
  {
    id: '37',
    title: 'Le cacao en Côte d\'Ivoire',
    subtitle: 'The world\'s top cocoa producer',
    difficulty: 'hard',
    estimatedMinutes: 9,
    category: 'article',
    region: 'ivory-coast',
    tags: ['economy', 'agriculture', 'chocolate', 'trade'],
    content: `La Côte d'Ivoire est le premier producteur mondial de cacao. Ce pays d'Afrique de l'Ouest fournit environ 40% du cacao utilisé dans le monde pour fabriquer du chocolat.

L'histoire du cacao ivoirien commence à l'époque coloniale, quand les Français ont développé les plantations. Après l'indépendance en 1960, le président Félix Houphouët-Boigny a fait du cacao la base de l'économie nationale.

Pendant les années 1970 et 1980, le « miracle ivoirien » était fondé sur les exportations de cacao. Le pays s'est développé rapidement, attirant des travailleurs des pays voisins.

Aujourd'hui, environ six millions d'Ivoiriens vivent du cacao. La plupart sont de petits producteurs qui cultivent quelques hectares. Le travail est dur : il faut planter, entretenir les arbres, récolter les cabosses et fermenter les fèves.

Le paradoxe du cacao ivoirien est cruel : les producteurs sont pauvres alors que le chocolat est un produit de luxe. Un planteur gagne en moyenne moins de deux euros par jour. Il n'a jamais goûté le chocolat fabriqué avec ses fèves.

Des initiatives de commerce équitable tentent d'améliorer la situation. Certaines entreprises paient un prix minimum garanti et financent des écoles et des dispensaires.

Le travail des enfants reste un problème grave dans les plantations. Des organisations internationales travaillent pour l'éliminer, mais les progrès sont lents.

L'avenir du cacao ivoirien dépend de nombreux facteurs : le changement climatique qui menace les cultures, la demande mondiale de chocolat et les efforts pour une filière plus juste.`,
  },
  {
    id: '38',
    title: 'À la pharmacie',
    subtitle: 'Getting medicine at the pharmacy',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    tags: ['health', 'vocabulary', 'daily-life'],
    content: `— Bonjour, j'ai besoin d'aspirine, s'il vous plaît.

— Bonjour. Vous avez une ordonnance ?

— Non, c'est juste pour un mal de tête.

— D'accord. En comprimés ou en gélules ?

— En comprimés, s'il vous plaît.

— Voilà. Autre chose ?

— Oui, vous avez quelque chose pour le rhume ?

— Je vous conseille ce sirop. C'est très efficace.

— D'accord, je le prends aussi. Combien je vous dois ?

— Onze euros cinquante.

— Voici. Merci et bonne journée !`,
  },
  {
    id: '39',
    title: 'Le multilinguisme suisse',
    subtitle: 'A country with four languages',
    difficulty: 'hard',
    estimatedMinutes: 8,
    category: 'culture',
    region: 'switzerland',
    tags: ['language', 'identity', 'politics', 'society'],
    content: `La Suisse est un pays de 8,5 millions d'habitants qui possède quatre langues nationales. Cette diversité linguistique est unique en Europe.

L'allemand est parlé par environ 63% de la population, principalement dans le nord et le centre du pays. Mais le « suisse allemand » parlé au quotidien est très différent de l'allemand standard.

Le français est la langue de 23% des Suisses, dans l'ouest du pays, en Suisse romande. Genève, Lausanne et Neuchâtel sont les principales villes francophones.

L'italien est parlé par 8% de la population, au sud, dans le Tessin. Cette région a une culture et une atmosphère méditerranéennes.

Le romanche, parlé par moins de 1% des Suisses, est reconnu comme langue nationale depuis 1938. C'est une langue latine ancienne, parlée dans quelques vallées des Grisons.

Comment un pays peut-il fonctionner avec quatre langues ? La réponse est le « principe de territorialité ». Chaque canton choisit sa ou ses langues officielles. Les citoyens s'adressent à l'administration fédérale dans leur langue.

L'école suisse enseigne une deuxième langue nationale dès le primaire. La plupart des Suisses parlent au moins deux langues, souvent trois avec l'anglais.

Cette diversité est une source de fierté mais aussi de tensions parfois. Le « Röstigraben », la frontière imaginaire entre Suisses alémaniques et romands, symbolise des différences culturelles réelles.

Pourtant, le multilinguisme reste au cœur de l'identité suisse. C'est la preuve que des communautés linguistiques différentes peuvent coexister pacifiquement.`,
  },
  {
    id: '40',
    title: 'Le zouk antillais',
    subtitle: 'The sound of the French Caribbean',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'martinique',
    tags: ['music', 'dance', 'Kassav', 'Caribbean'],
    content: `Le zouk est né en Guadeloupe et en Martinique au début des années 1980. Cette musique sensuelle a conquis le monde francophone et au-delà.

Le groupe Kassav' est le créateur du zouk. Pierre-Édouard Décimus et Jacob Desvarieux ont fusionné les rythmes traditionnels antillais avec des sons modernes : synthétiseurs, guitares électriques et boîtes à rythmes.

Le mot « zouk » signifie « fête » en créole. Et c'est exactement ce que cette musique inspire : la joie, la danse et la célébration. Le rythme est chaloupé, parfait pour danser à deux.

« Zouk la sé sèl médikaman nou ni », chantait Kassav' : « Le zouk est le seul médicament que nous avons ». Cette chanson de 1984 est devenue l'hymne du genre.

Le zouk se danse collé-serré. Les partenaires se tiennent près l'un de l'autre et bougent les hanches au rythme de la musique. C'est une danse sensuelle mais élégante.

Dans les années 1990, le zouk s'est répandu en Afrique, au Brésil et dans l'océan Indien. Des artistes cap-verdiens, brésiliens et africains ont créé leurs propres versions.

Aujourd'hui, le zouk continue d'évoluer. De nouveaux artistes mélangent le zouk avec le R&B, le hip-hop et l'électro. Mais le son original de Kassav' reste une référence incontournable.`,
  },
  {
    id: '41',
    title: 'La diversité linguistique du Cameroun',
    subtitle: 'A country with 280 languages',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'culture',
    region: 'cameroon',
    tags: ['language', 'diversity', 'identity', 'bilingualism'],
    content: `Le Cameroun est souvent appelé « l'Afrique en miniature » pour sa diversité géographique et culturelle. Cette diversité se reflète dans ses langues : le pays compte environ 280 langues différentes.

Les deux langues officielles sont le français et l'anglais, héritage de la colonisation. Le Cameroun a été divisé entre la France et le Royaume-Uni après la Première Guerre mondiale, et cette division linguistique persiste.

Environ 80% du pays est francophone, principalement dans l'est et le sud. Les régions anglophones, le Nord-Ouest et le Sud-Ouest, représentent environ 20% de la population.

Le bilinguisme officiel est inscrit dans la constitution. Les documents officiels existent dans les deux langues. L'école enseigne les deux langues. Mais dans la pratique, peu de Camerounais maîtrisent vraiment les deux.

Parmi les 280 langues locales, certaines sont parlées par des millions de personnes. Le foulfouldé est la lingua franca du nord. L'ewondo et le douala sont importants dans le sud. Le pidgin english, mélange d'anglais et de langues locales, est très utilisé dans les zones anglophones.

La question linguistique est devenue politique. Les anglophones se plaignent de marginalisation par la majorité francophone. Depuis 2016, une crise grave secoue les régions anglophones.

Malgré ces tensions, la richesse linguistique du Cameroun reste un patrimoine extraordinaire. Les langues locales portent des traditions, des savoirs et des visions du monde uniques. Des efforts sont faits pour les préserver et les enseigner aux jeunes générations.`,
  },
  {
    id: '42',
    title: 'Le Carnaval de Québec',
    subtitle: 'The world\'s largest winter carnival',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'culture',
    region: 'quebec',
    tags: ['festival', 'winter', 'tradition', 'celebration'],
    content: `Le Carnaval de Québec est le plus grand carnaval d'hiver au monde. Chaque année en février, la ville de Québec se transforme en une fête géante malgré le froid glacial.

Le carnaval existe depuis 1894, mais il a pris sa forme actuelle en 1955. Bonhomme Carnaval, un grand bonhomme de neige joyeux avec une ceinture fléchée, est la mascotte de l'événement.

Les activités sont nombreuses et variées. Les courses de canots sur le fleuve Saint-Laurent gelé sont spectaculaires. Des équipes traversent la glace en tirant leurs canots, parfois en pagayant dans l'eau glacée.

Les sculptures de neige et de glace attirent des artistes du monde entier. Le Palais de Glace, résidence de Bonhomme, est reconstruit chaque année avec des milliers de blocs de glace.

Les bains de neige sont une tradition amusante. Des courageux en maillot de bain se roulent dans la neige devant la foule. C'est une façon de prouver qu'on résiste au froid québécois !

La « caribou », une boisson traditionnelle à base de vin rouge et d'alcool, réchauffe les fêtards. On la boit dans un tube de plastique appelé « canne à caribou ».

Le Carnaval est une célébration de la culture québécoise et de la joie de vivre en hiver. Il prouve que le froid extrême peut devenir une source de plaisir plutôt qu'un obstacle.`,
  },
  {
    id: '43',
    title: 'La plage en Guadeloupe',
    subtitle: 'Caribbean beach life',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'travel',
    region: 'guadeloupe',
    tags: ['beach', 'travel', 'nature', 'Caribbean'],
    content: `La Guadeloupe possède certaines des plus belles plages des Caraïbes. Avec son eau turquoise et son sable fin, c'est un paradis tropical.

La plage de la Grande Anse, à Deshaies, est une des plus célèbres. Le sable est doré, les cocotiers offrent de l'ombre. Les vagues sont parfaites pour les enfants.

À Sainte-Anne, les plages sont protégées par un récif de corail. L'eau est calme comme une piscine. On peut voir des poissons colorés avec un simple masque.

La plage de Malendure, sur la côte ouest, est le spot de plongée le plus connu. La réserve Cousteau protège des fonds marins exceptionnels. Les tortues y nagent tranquillement.

Les Guadeloupéens aiment passer le dimanche à la plage en famille. On installe des parasols, on prépare un barbecue, on joue aux dominos. La musique zouk accompagne la journée.

Le soir, le coucher de soleil sur la mer est magique. Les couleurs changent de l'orange au rose puis au violet. C'est le moment parfait pour un ti-punch.

Attention au soleil tropical ! La crème solaire est indispensable. Et n'oubliez pas de goûter les bokits vendus sur la plage : ces sandwichs frits sont délicieux.`,
  },
  {
    id: '44',
    title: 'Le thiéboudiène sénégalais',
    subtitle: 'Senegal\'s national dish',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'food',
    region: 'senegal',
    tags: ['cuisine', 'recipe', 'tradition', 'fish'],
    content: `Le thiéboudiène, aussi écrit « tiep », est le plat national du Sénégal. Ce riz au poisson est servi presque tous les jours dans les familles sénégalaises.

Le nom vient du wolof : « thieb » signifie riz et « diène » signifie poisson. C'est une recette qui date de plusieurs siècles, originaire de Saint-Louis du Sénégal.

La préparation est longue et demande du savoir-faire. Le poisson, généralement du thiof (mérou blanc), est farci d'un mélange d'herbes appelé « rof ». On y met du persil, de l'ail, du piment et du bouillon cube.

Les légumes sont essentiels : carottes, aubergines, chou, manioc, citrouille. Chaque légume est ajouté au bon moment pour une cuisson parfaite.

Le riz est cuit dans le bouillon de poisson et de légumes. Il absorbe toutes les saveurs et prend une couleur rouge grâce à la tomate concentrée.

Le plat est traditionnellement servi dans un grand bol. Toute la famille mange ensemble, avec la main droite. Le chef de famille distribue les morceaux de poisson.

L'art de faire un bon thiéboudiène se transmet de mère en fille. Chaque famille a ses secrets : un ingrédient spécial, un temps de cuisson particulier.

Manger un thiéboudiène fait maison au Sénégal est une expérience inoubliable. C'est bien plus qu'un repas : c'est un moment de partage et de teranga, l'hospitalité sénégalaise.`,
  },
  {
    id: '45',
    title: 'Les vendanges en France',
    subtitle: 'The grape harvest tradition',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'culture',
    region: 'france',
    tags: ['wine', 'tradition', 'agriculture', 'regions'],
    content: `Les vendanges marquent le moment le plus important de l'année pour les vignerons français. C'est le temps de récolter le raisin qui deviendra vin.

En France, les vendanges ont lieu entre août et octobre, selon les régions et les cépages. Dans le sud, on commence tôt car le raisin mûrit vite. En Champagne, on attend parfois jusqu'en octobre.

La date des vendanges est cruciale. Récolter trop tôt donne un vin acide. Récolter trop tard peut abîmer le raisin. Le vigneron surveille la maturité des grains chaque jour.

Traditionnellement, les vendanges étaient entièrement manuelles. Des équipes de vendangeurs coupaient les grappes à la main. C'était un travail dur mais joyeux, avec des repas copieux et des chansons.

Aujourd'hui, beaucoup de domaines utilisent des machines à vendanger. Mais pour les grands vins, la récolte manuelle reste obligatoire. En Champagne, par exemple, la loi impose de vendanger à la main.

Les vendanges sont aussi une période de fête. Chaque région a ses traditions : le ban des vendanges en Bourgogne, les fêtes du vin nouveau en Beaujolais. On célèbre la récolte avec des repas et des dégustations.

Pour beaucoup de jeunes, participer aux vendanges est une expérience unique. On travaille dur, on dort peu, mais on découvre un monde fascinant et on se fait des amis pour la vie.`,
  },
  {
    id: '46',
    title: 'À la gare',
    subtitle: 'Taking the train',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'france',
    tags: ['travel', 'train', 'vocabulary'],
    content: `— Bonjour, je voudrais un billet pour Lyon, s'il vous plaît.

— Aller simple ou aller-retour ?

— Aller-retour. Je reviens dimanche.

— Vous préférez quelle heure de départ ?

— Le train du matin, vers huit heures.

— Il y a un TGV à 8h15. Arrivée à 10h05.

— Parfait. C'est combien ?

— En deuxième classe, c'est 85 euros.

— D'accord, je prends.

— Vous voulez une place côté fenêtre ou couloir ?

— Côté fenêtre, s'il vous plaît.

— Voilà votre billet. Quai numéro 7.

— Merci. À quelle heure je dois être à la gare ?

— Soyez là dix minutes avant le départ.`,
  },
  {
    id: '47',
    title: 'Le tagine marocain',
    subtitle: 'Morocco\'s iconic slow-cooked dish',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'food',
    region: 'morocco',
    tags: ['cuisine', 'recipe', 'tradition'],
    content: `Le tagine est l'un des plats les plus emblématiques du Maroc. Son nom vient du récipient en terre cuite dans lequel il est préparé : un plat rond avec un couvercle conique.

La forme du tagine est ingénieuse. Le couvercle pointu permet à la vapeur de monter, de se condenser et de retomber sur les aliments. La cuisson est lente et douce, les saveurs se concentrent.

Les variétés de tagines sont infinies. Le tagine de poulet aux citrons confits et olives est un classique. Les citrons confits apportent une saveur unique, à la fois acide et parfumée.

Le tagine d'agneau aux pruneaux et amandes mélange sucré et salé, une caractéristique de la cuisine marocaine. Les épices comme le safran, le gingembre et la cannelle parfument la viande.

Pour les végétariens, le tagine de légumes est délicieux. On y met des carottes, des courgettes, des pois chiches et des olives. Le tout cuit lentement jusqu'à ce que les légumes fondent.

Les secrets d'un bon tagine : la patience et les bons ingrédients. La cuisson dure au moins une heure, parfois deux. On utilise de l'huile d'olive généreuse et des épices de qualité.

Le tagine se mange traditionnellement avec les doigts. On prend un morceau de pain pour saisir la viande et les légumes. Le pain sert aussi à saucer le délicieux jus au fond du plat.`,
  },
  {
    id: '48',
    title: 'Victor Hugo et Les Misérables',
    subtitle: 'France\'s greatest novelist',
    difficulty: 'university',
    estimatedMinutes: 12,
    category: 'literature',
    region: 'france',
    tags: ['literature', 'romanticism', 'history', 'society'],
    content: `Victor Hugo (1802-1885) est considéré comme l'un des plus grands écrivains de la littérature française. Son roman « Les Misérables », publié en 1862, reste une œuvre majeure qui interroge la société et la condition humaine.

Hugo a écrit « Les Misérables » pendant son exil politique dans les îles Anglo-Normandes. Opposant à Napoléon III, il avait dû fuir la France en 1851. Ce long exil de près de vingt ans a profondément influencé son écriture.

Le roman raconte l'histoire de Jean Valjean, un ancien bagnard qui cherche la rédemption. Condamné pour avoir volé un pain, il passe dix-neuf ans aux galères. À sa libération, un évêque lui offre le pardon et une nouvelle chance.

Mais « Les Misérables » est bien plus que l'histoire d'un homme. C'est une fresque sociale de la France du XIXe siècle. Hugo y dénonce l'injustice, la misère, l'exploitation des pauvres. Les personnages de Fantine, Cosette et Gavroche incarnent les victimes de cette société.

L'ambition littéraire de Hugo est immense. Il mêle le récit romanesque à des digressions historiques, philosophiques et sociales. Le chapitre sur la bataille de Waterloo s'étend sur plusieurs dizaines de pages. La description des égouts de Paris devient une réflexion sur la ville moderne.

Hugo utilise le roman comme tribune politique. Il défend les opprimés, critique la peine de mort, dénonce le travail des enfants. Pour lui, la littérature doit transformer la société.

Le personnage de l'inspecteur Javert représente la loi aveugle, incapable de comprendre la nuance morale. Sa confrontation avec Jean Valjean illustre le conflit entre la justice légale et la justice humaine.

« Les Misérables » a connu un succès immédiat et durable. Le roman a été traduit dans toutes les langues, adapté au théâtre, au cinéma et en comédie musicale. Ses thèmes — la rédemption, la justice sociale, le pouvoir de l'amour — restent universels et actuels.`,
  },
  {
    id: '49',
    title: 'Le Manneken-Pis',
    subtitle: 'Brussels\' famous little statue',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'culture',
    region: 'belgium',
    tags: ['monument', 'Brussels', 'tradition', 'humor'],
    content: `Le Manneken-Pis est une petite fontaine en bronze à Bruxelles. Elle représente un petit garçon qui fait pipi. Cette statue de 55 centimètres est l'un des symboles les plus célèbres de la Belgique.

Personne ne sait exactement pourquoi cette statue existe. Il y a beaucoup de légendes. Une histoire raconte qu'un petit garçon a sauvé la ville en éteignant un incendie de cette façon !

La statue originale date du XVIIe siècle. Elle a été volée plusieurs fois au cours de l'histoire. Aujourd'hui, l'original est dans un musée, et une copie est exposée dans la rue.

Le Manneken-Pis possède une garde-robe impressionnante : plus de 1000 costumes ! Plusieurs fois par semaine, on l'habille pour des occasions spéciales. Il porte des costumes de tous les pays du monde.

Quand une fête ou un événement important a lieu, le Manneken-Pis porte un costume approprié. Pour le 14 juillet, il est habillé en Français. Pour la Saint-Patrick, il porte du vert.

Les touristes adorent cette statue. C'est amusant et typiquement belge. Les Belges sont connus pour leur humour et leur capacité à ne pas se prendre au sérieux.

Il existe aussi une Jeanneke-Pis (une petite fille) et un Zinneke-Pis (un chien). Mais le Manneken-Pis reste le plus célèbre.`,
  },
  {
    id: '50',
    title: 'La culture amazighe au Maroc',
    subtitle: 'The indigenous Berber heritage',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'culture',
    region: 'morocco',
    tags: ['Berber', 'identity', 'history', 'tradition'],
    content: `Les Amazighs, aussi appelés Berbères, sont le peuple autochtone de l'Afrique du Nord. Au Maroc, ils représentent une part importante de la population et leur culture connaît une renaissance remarquable.

Le mot « Amazigh » signifie « homme libre » en tamazight, la langue berbère. Les Amazighs ont habité le Maroc bien avant l'arrivée des Arabes au VIIe siècle. Leur histoire remonte à plusieurs millénaires.

La langue amazighe, le tamazight, a été reconnue comme langue officielle du Maroc en 2011. Cette reconnaissance constitutionnelle marque un tournant historique après des décennies de marginalisation linguistique.

L'alphabet amazigh, le tifinagh, est l'un des plus anciens au monde. Ces caractères géométriques étaient utilisés par les anciens Libyens. Aujourd'hui, le tifinagh est enseigné dans les écoles marocaines.

Les régions amazighes présentent une grande diversité. Le Rif au nord, le Moyen Atlas au centre, le Haut Atlas et le Souss au sud ont chacun leurs dialectes, leurs traditions et leurs arts.

L'artisanat amazigh est réputé : tapis aux motifs géométriques, bijoux en argent, poteries décorées. Ces arts transmettent des symboles anciens dont le sens se perd parfois dans le temps.

La musique amazighe est variée : les Rwais du Souss, les groupes Ahidous du Moyen Atlas, les chants de l'Ahwach du Haut Atlas. Chaque région a ses instruments et ses danses.

La nouvelle année amazighe, Yennayer, est célébrée le 13 janvier. Elle marque le début du calendrier agraire. Depuis 2018, c'est un jour férié officiel au Maroc.

La reconnaissance de l'identité amazighe représente un enjeu politique majeur. Des associations militent pour une meilleure place de la langue et de la culture dans l'enseignement et les médias.`,
  },
  {
    id: '51',
    title: 'Le vodou haïtien',
    subtitle: 'Haiti\'s misunderstood spiritual tradition',
    difficulty: 'university',
    estimatedMinutes: 12,
    category: 'culture',
    region: 'haiti',
    tags: ['religion', 'spirituality', 'Africa', 'syncretism'],
    content: `Le vodou haïtien est une religion afro-caribéenne née de la rencontre entre les croyances africaines et le catholicisme imposé par les colons. Souvent mal compris et caricaturé, le vodou est en réalité une tradition spirituelle complexe et profonde.

Les origines du vodou remontent aux royaumes d'Afrique de l'Ouest, notamment le Dahomey (actuel Bénin). Les esclaves déportés vers Saint-Domingue ont conservé leurs croyances malgré l'interdiction coloniale. Ils les ont adaptées en associant leurs divinités aux saints catholiques.

Au cœur du vodou se trouve le Bondye, le « Bon Dieu », créateur suprême mais distant. Les fidèles communiquent avec lui par l'intermédiaire des lwa (ou loa), des esprits qui gouvernent différents aspects de la vie.

Les lwa sont organisés en « nations » selon leurs origines africaines. Papa Legba ouvre les portes entre le monde visible et invisible. Erzulie Freda est la déesse de l'amour. Baron Samedi règne sur les morts. Ogou est le guerrier. Chaque lwa a sa personnalité, ses préférences et ses symboles.

Les cérémonies vodou ont lieu dans des temples appelés « houmfors », dirigés par des prêtres (houngans) ou des prêtresses (mambos). Les rituels incluent des chants, des danses, des offrandes et des possessions. Quand un lwa « monte » un fidèle, celui-ci devient le véhicule temporaire de l'esprit.

Le vodou a joué un rôle crucial dans l'histoire haïtienne. La cérémonie du Bois Caïman de 1791, qui a déclenché la révolution, était une cérémonie vodou. Le vodou a été un instrument de résistance et de cohésion pour les esclaves.

Malgré cela, le vodou a été persécuté pendant des siècles. L'Église catholique et certains gouvernements haïtiens ont mené des campagnes de répression. En 2003, le vodou a finalement été reconnu comme religion officielle d'Haïti.

Les stéréotypes hollywoodiens — zombies, poupées percées d'aiguilles — déforment gravement le vodou. Ces clichés reflètent la peur coloniale d'une tradition qui a permis aux esclaves de résister et de se libérer.`,
  },
  {
    id: '52',
    title: 'Le sport en France',
    subtitle: 'Popular sports in French culture',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'sports',
    region: 'france',
    tags: ['sports', 'football', 'cycling', 'culture'],
    content: `Le sport occupe une place importante dans la vie des Français. Que ce soit comme spectateurs ou comme pratiquants, des millions de personnes suivent les compétitions.

Le football est le sport le plus populaire. L'équipe de France a gagné deux Coupes du monde, en 1998 et 2018. Les matchs de Ligue 1 attirent des millions de téléspectateurs chaque weekend.

Le cyclisme a une longue tradition en France. Le Tour de France, créé en 1903, est l'événement sportif le plus regardé au monde. En juillet, tout le pays suit les coureurs à travers les montagnes et les plaines.

Le rugby est très populaire dans le sud-ouest. Des villes comme Toulouse, Clermont-Ferrand et Toulon vivent au rythme de leur équipe. Le Tournoi des Six Nations passionne les fans.

Le tennis français a produit de grands champions. Roland-Garros, le tournoi de Paris, est l'un des quatre tournois du Grand Chelem. C'est la plus grande compétition sur terre battue.

Les sports d'hiver sont importants dans les Alpes et les Pyrénées. Le ski alpin et le biathlon sont suivis avec passion. Les stations françaises accueillent des compétitions internationales.

La pétanque, jeu traditionnel du sud, est pratiquée par des millions de Français. L'été, les places des villages résonnent du bruit des boules.

Le sport est aussi un vecteur d'intégration sociale. Des associations utilisent le sport pour aider les jeunes des quartiers difficiles.`,
  },
  {
    id: '53',
    title: 'L\'histoire du sucre en Guadeloupe',
    subtitle: 'Sugar cane and its colonial legacy',
    difficulty: 'hard',
    estimatedMinutes: 9,
    category: 'history',
    region: 'guadeloupe',
    tags: ['sugar', 'slavery', 'colonialism', 'economy'],
    content: `La canne à sucre a façonné l'histoire de la Guadeloupe pendant plus de trois siècles. Cette plante est à la fois source de richesse et symbole de la tragédie de l'esclavage.

Les Européens ont introduit la canne à sucre aux Antilles au XVIIe siècle. Le climat tropical était parfait pour cette culture. Mais la canne demande une main-d'œuvre considérable, ce qui a conduit au développement de la traite esclavagiste.

Des centaines de milliers d'Africains ont été déportés vers la Guadeloupe pour travailler dans les plantations. Les conditions étaient inhumaines : travail épuisant, châtiments corporels, espérance de vie très courte.

Le sucre guadeloupéen faisait la fortune des planteurs et des marchands français. Les profits de « l'économie de plantation » ont contribué au développement économique de la France métropolitaine.

L'abolition de l'esclavage en 1848 a marqué un tournant, mais pas la fin de l'industrie sucrière. Les anciens esclaves sont souvent restés comme travailleurs dans les plantations. Des immigrants indiens et chinois sont venus remplacer la main-d'œuvre manquante.

Au XXe siècle, l'industrie sucrière guadeloupéenne a décliné. La concurrence du sucre de betterave européen et du sucre des autres pays a rendu les plantations moins rentables.

Aujourd'hui, quelques distilleries produisent du rhum agricole réputé. Les anciennes habitations sucrières sont devenues des musées. La mémoire de l'esclavage est honorée le 27 mai, jour de commémoration de l'abolition.

L'histoire du sucre continue d'influencer la société guadeloupéenne. Elle explique la composition de la population, les structures sociales et le rapport à l'histoire coloniale.`,
  },
  {
    id: '54',
    title: 'Félix Houphouët-Boigny',
    subtitle: 'The father of Ivory Coast',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'history',
    region: 'ivory-coast',
    tags: ['politics', 'independence', 'leader', 'Africa'],
    content: `Félix Houphouët-Boigny (1905-1993) a dirigé la Côte d'Ivoire pendant plus de trente ans. Cette figure controversée est considérée comme le père de la nation ivoirienne.

Né dans une famille de chefs traditionnels baoulés, Houphouët-Boigny a fait des études de médecine. Il a d'abord travaillé comme médecin avant de se lancer en politique.

Dans les années 1940, il a fondé le Syndicat agricole africain pour défendre les planteurs africains contre les colons. Il a ensuite créé le Parti démocratique de Côte d'Ivoire (PDCI).

Élu député français en 1945, Houphouët-Boigny a joué un rôle important dans la vie politique française. Il a même été ministre sous plusieurs gouvernements de la IVe République.

En 1960, la Côte d'Ivoire est devenue indépendante avec Houphouët-Boigny comme président. Il a choisi une voie de développement fondée sur l'agriculture d'exportation — cacao, café, bois — et des liens étroits avec la France.

Le « miracle ivoirien » des années 1960-70 a fait de la Côte d'Ivoire le pays le plus prospère d'Afrique de l'Ouest. La croissance économique était forte, les infrastructures se développaient.

Mais ce modèle avait ses limites. Le pays dépendait des cours mondiaux des matières premières. Le système politique était autoritaire, avec un parti unique. Les opposants étaient réprimés.

Houphouët-Boigny a laissé un héritage monumental : la basilique Notre-Dame de la Paix à Yamoussoukro, la plus grande église du monde. Ce projet pharaonique symbolise les contradictions du personnage.

Après sa mort en 1993, la Côte d'Ivoire a connu une période d'instabilité. Les conflits ethniques et politiques que son autorité avait contenus ont éclaté, menant à une guerre civile au début des années 2000.`,
  },
  {
    id: '55',
    title: 'Le mont Cameroun',
    subtitle: 'West Africa\'s highest peak',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'travel',
    region: 'cameroon',
    tags: ['nature', 'volcano', 'hiking', 'geography'],
    content: `Le mont Cameroun est le point culminant de l'Afrique de l'Ouest. Ce volcan actif de 4 095 mètres domine la ville de Buea et offre des paysages spectaculaires.

Les habitants l'appellent « Mongo ma Ndemi » en langue bakweri, ce qui signifie « la montagne des dieux ». Le volcan est sacré pour les peuples qui vivent à ses pieds.

Le mont Cameroun est toujours actif. La dernière éruption date de 2000. Des coulées de lave ont détruit des plantations mais, heureusement, fait peu de victimes. Les scientifiques surveillent le volcan en permanence.

L'ascension du mont Cameroun est un défi pour les randonneurs. Le parcours traverse plusieurs zones climatiques : forêt tropicale, prairies d'altitude, paysages lunaires près du sommet.

Chaque année, une course d'ascension et de descente rapide est organisée. Les meilleurs coureurs gravissent les 4 000 mètres et redescendent en moins de 5 heures. C'est l'un des trails les plus difficiles du monde.

Les pentes du volcan sont couvertes de plantations. Le sol volcanique est très fertile. On y cultive du thé, des bananes et du cacao. Les plantations de la Cameroon Development Corporation emploient des milliers de travailleurs.

Le mont Cameroun abrite aussi une biodiversité exceptionnelle. On y trouve des espèces endémiques, comme certains oiseaux et amphibiens qui n'existent nulle part ailleurs.

Pour les visiteurs, c'est une expérience inoubliable. Le lever du soleil au sommet, au-dessus des nuages, avec vue sur l'océan Atlantique, est d'une beauté saisissante.`,
  },
  {
    id: '56',
    title: 'Ma première journée à Paris',
    subtitle: 'A visitor\'s first day in Paris',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'story',
    region: 'france',
    tags: ['travel', 'Paris', 'tourism', 'first-time'],
    content: `Je suis arrivé à Paris ce matin. C'est ma première fois dans cette ville. Je suis très content !

D'abord, j'ai pris le métro. C'est facile à comprendre. J'ai trouvé ma station sans problème.

Ensuite, j'ai visité la Tour Eiffel. Elle est immense ! J'ai pris beaucoup de photos.

À midi, j'ai mangé dans un petit café. J'ai commandé un croque-monsieur et un café. C'était bon.

L'après-midi, j'ai marché sur les Champs-Élysées. Il y a beaucoup de magasins et de gens.

Puis, j'ai vu l'Arc de Triomphe. Il est très impressionnant.

Le soir, je suis fatigué mais heureux. Paris est une ville magnifique. Demain, je visite le Louvre.`,
  },
  {
    id: '57',
    title: 'La teranga sénégalaise',
    subtitle: 'The art of Senegalese hospitality',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'culture',
    region: 'senegal',
    tags: ['hospitality', 'tradition', 'values', 'society'],
    content: `La teranga est le concept qui définit le mieux la culture sénégalaise. Ce mot wolof signifie « hospitalité », mais il représente bien plus qu'un simple accueil.

Au Sénégal, l'étranger est sacré. Quand quelqu'un arrive chez vous, vous devez tout faire pour qu'il se sente bien. Vous lui offrez à manger, même si vous avez peu. Vous lui donnez le meilleur lit. Vous le traitez comme un membre de la famille.

La teranga s'exprime aussi dans la vie quotidienne. À l'heure du repas, on invite les voisins et les passants à partager le bol. Refuser serait impoli. On mange ensemble, autour du même plat, avec la main droite.

Le thé à la menthe, le « ataya », est un rituel de teranga. On le prépare en trois services, de plus en plus sucrés. « Le premier est amer comme la vie, le deuxième est doux comme l'amour, le troisième est sucré comme la mort », dit le proverbe.

Les Sénégalais prennent le temps d'échanger. Les salutations sont longues et détaillées. On demande des nouvelles de la famille, des enfants, du travail. Cette politesse n'est pas formelle : elle exprime un vrai intérêt pour l'autre.

La teranga a aussi une dimension spirituelle. Dans l'islam sénégalais, l'hospitalité est un devoir religieux. Mais la tradition existait déjà avant l'arrivée de l'islam, dans les valeurs africaines traditionnelles.

Aujourd'hui, la teranga est menacée par la vie moderne et la pauvreté. Mais elle reste une valeur centrale que les Sénégalais défendent avec fierté. C'est leur marque de fabrique dans le monde.`,
  },
  {
    id: '58',
    title: 'Les médinas marocaines',
    subtitle: 'The ancient walled cities of Morocco',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'travel',
    region: 'morocco',
    tags: ['architecture', 'history', 'urbanism', 'heritage'],
    content: `Les médinas sont les quartiers historiques des villes marocaines. Ces labyrinthes de ruelles étroites sont des témoins vivants de l'histoire et de l'urbanisme arabo-musulman.

Le mot « médina » signifie simplement « ville » en arabe. Mais au Maroc, il désigne spécifiquement la vieille ville, par opposition à la ville nouvelle construite pendant le protectorat français.

L'architecture des médinas répond à des principes précis. Les rues sont étroites pour créer de l'ombre. Les maisons n'ont pas de fenêtres sur la rue pour préserver l'intimité. La vie familiale s'organise autour d'un patio intérieur.

Les médinas de Fès, Marrakech, Essaouira et Tétouan sont inscrites au patrimoine mondial de l'UNESCO. Celle de Fès est la plus grande zone piétonne du monde, avec plus de 9 000 ruelles.

Chaque médina est organisée autour de la grande mosquée et des souks. Les artisans sont regroupés par métier : tanneurs, bijoutiers, menuisiers, potiers. Cette organisation remonte au Moyen Âge.

Les fondouks sont d'anciens caravansérails où les marchands logeaient avec leurs marchandises. Aujourd'hui, beaucoup sont transformés en ateliers d'artisanat ou en riads-hôtels.

Se perdre dans une médina fait partie de l'expérience. Les ruelles se ressemblent, les repères sont difficiles à trouver. Les enfants du quartier proposent souvent de guider les touristes — moyennant un pourboire.

La vie dans la médina est différente de la vie moderne. Pas de voitures, juste des ânes et des charrettes. Des fontaines publiques, des fours de quartier où les familles apportent leur pain à cuire.`,
  },
  {
    id: '59',
    title: 'Marcel Proust et À la recherche du temps perdu',
    subtitle: 'A literary monument of French literature',
    difficulty: 'university',
    estimatedMinutes: 14,
    category: 'literature',
    region: 'france',
    tags: ['literature', 'modernism', 'memory', 'psychology'],
    content: `Marcel Proust (1871-1922) a consacré les dernières années de sa vie à écrire « À la recherche du temps perdu », une œuvre monumentale de plus de 3 000 pages qui a révolutionné le roman moderne.

L'œuvre se compose de sept volumes publiés entre 1913 et 1927. Elle raconte la vie du narrateur, de son enfance à Combray jusqu'à sa vocation d'écrivain, à travers la société française de la Belle Époque.

Le thème central de la Recherche est la mémoire. Proust distingue la mémoire volontaire, celle des faits qu'on peut rappeler consciemment, et la mémoire involontaire, qui ressurgit spontanément par les sensations.

La fameuse scène de la madeleine illustre ce concept. Le narrateur trempe une madeleine dans son thé, et soudain, toute son enfance à Combray lui revient avec une intensité extraordinaire. Cette « mémoire affective » devient la clé de son œuvre future.

Le style de Proust est unique. Ses phrases sont extrêmement longues, parfois plusieurs pages. Elles suivent le flux de la pensée, avec des digressions, des parenthèses, des nuances infinies. Lire Proust demande une attention soutenue.

L'analyse psychologique est d'une finesse inégalée. Proust décortique les sentiments — l'amour, la jalousie, le snobisme, le désir — avec une précision quasi scientifique. Il montre comment nos perceptions sont toujours subjectives et changeantes.

La peinture de la société est également remarquable. Proust décrit les salons aristocratiques, la bourgeoisie mondaine, les domestiques, les artistes. L'affaire Dreyfus traverse l'œuvre et révèle les divisions sociales.

Le temps est le sujet ultime du livre. Proust montre comment le temps transforme les êtres et les relations. Les personnages vieillissent, les amours s'éteignent, les gloires passent. Seul l'art peut fixer ce qui est voué à disparaître.

La modernité de Proust tient aussi à sa conception du moi. Le narrateur n'est pas un personnage stable mais une succession d'états différents. L'identité est fragmentée, changeante, construite par la mémoire.

Proust a écrit la Recherche en reclus, dans sa chambre tapissée de liège pour l'isoler du bruit. Il travaillait la nuit, ajoutant constamment des pages à son manuscrit. Il est mort avant d'avoir achevé la révision finale.

L'influence de Proust sur la littérature du XXe siècle est immense. Virginia Woolf, Samuel Beckett, Claude Simon et bien d'autres ont reconnu leur dette envers lui. La Recherche reste une expérience de lecture unique, exigeante mais transformatrice.`,
  },
  {
    id: '60',
    title: 'Le métro parisien',
    subtitle: 'Navigating the Paris underground',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'travel',
    region: 'france',
    tags: ['transport', 'Paris', 'daily-life'],
    content: `Le métro de Paris est l'un des plus anciens du monde. La première ligne a ouvert en 1900. Aujourd'hui, 16 lignes transportent des millions de passagers chaque jour.

Les stations de métro ont des noms célèbres : Champs-Élysées, Opéra, Bastille. Certaines sont décorées de façon unique. La station Louvre-Rivoli ressemble à un musée.

Pour prendre le métro, vous avez besoin d'un ticket ou d'un pass Navigo. Le ticket « t+ » permet un voyage avec correspondances. Vous pouvez acheter des carnets de 10 tickets pour économiser.

Le plan du métro semble compliqué au début, mais il est logique. Chaque ligne a une couleur et un numéro. On suit la direction du terminus.

Aux heures de pointe, le métro est bondé. Les Parisiens marchent vite et ne sourient pas beaucoup. C'est normal, ne le prenez pas personnellement !

Attention aux pickpockets, surtout sur les lignes touristiques. Gardez votre sac devant vous et surveillez votre téléphone.

La dernière rame part vers minuit. Le weekend, certaines lignes circulent plus tard. Le métro est fermé la nuit, mais il y a des bus Noctilien.

Le métro parisien n'est pas toujours propre ou agréable, mais il est très efficace. C'est le moyen le plus rapide pour traverser Paris.`,
  },
  {
    id: '61',
    title: 'La rentrée scolaire',
    subtitle: 'The start of the French school year',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'culture',
    region: 'france',
    tags: ['education', 'tradition', 'children', 'autumn'],
    content: `La rentrée scolaire en France a lieu début septembre. C'est un moment important pour les familles et un événement national.

Chaque année, des millions d'élèves retournent à l'école. Les parents achètent les fournitures scolaires : cahiers, crayons, cartables. Les magasins font des promotions spéciales.

Le premier jour d'école est émouvant, surtout pour les petits. Les parents accompagnent leurs enfants jusqu'à la classe. Certains enfants pleurent, d'autres sont excités.

En France, l'école est obligatoire de 3 à 16 ans. L'école maternelle accueille les enfants de 3 à 6 ans. Puis vient l'école primaire, le collège et le lycée.

Les horaires scolaires français sont particuliers. Les journées sont longues, souvent de 8h30 à 16h30. Le mercredi après-midi est généralement libre.

La cantine scolaire est une tradition française. Les repas sont équilibrés avec une entrée, un plat principal, un fromage et un dessert. La France considère que bien manger fait partie de l'éducation.

Les devoirs sont donnés dès le primaire. Les enfants travaillent le soir à la maison. Les parents aident souvent, ce qui crée parfois des tensions !

La rentrée marque aussi la fin des vacances d'été. Les Français parlent de « rentrée » pour tout : la rentrée politique, la rentrée littéraire, la rentrée culturelle. C'est vraiment le début d'une nouvelle année.`,
  },
  {
    id: '62',
    title: 'Le créole martiniquais',
    subtitle: 'The language of Martinique',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'culture',
    region: 'martinique',
    tags: ['language', 'creole', 'identity', 'linguistics'],
    content: `Le créole martiniquais est la langue maternelle de la grande majorité des Martiniquais. C'est un créole à base lexicale française, né pendant la période esclavagiste.

Le créole s'est formé au XVIIe siècle sur les plantations. Les esclaves africains, venus de régions différentes, avaient besoin d'une langue commune pour communiquer entre eux et avec les maîtres français.

La grammaire créole est très différente du français. Il n'y a pas de conjugaison complexe. Le temps est indiqué par des marqueurs placés avant le verbe. « Mwen ka manjé » signifie « je mange » (présent), « Mwen té manjé » signifie « j'ai mangé » (passé).

Le vocabulaire vient principalement du français, mais transformé. « Dlo » vient de « de l'eau », « zié » vient de « les yeux », « lapli » vient de « la pluie ». Certains mots ont des origines africaines ou caraïbes.

Pendant longtemps, le créole était dévalorisé. L'école enseignait uniquement en français. Parler créole était considéré comme vulgaire. Cette diglossie a créé un complexe chez de nombreux Martiniquais.

Aujourd'hui, le créole est revalorisé. Il est enseigné comme option dans les écoles. Des écrivains comme Patrick Chamoiseau écrivent en créole ou mêlent français et créole. Le mouvement de la créolité revendique cette langue comme patrimoine.

Le créole martiniquais a des proverbes savoureux. « Sé grenn diri ki ka fè sak diri » (Ce sont les grains de riz qui font le sac de riz) signifie que les petites choses font les grandes. La sagesse populaire s'exprime mieux en créole.`,
  },
  {
    id: '63',
    title: 'Le petit-déjeuner français',
    subtitle: 'How the French start their day',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'food',
    region: 'france',
    tags: ['breakfast', 'cuisine', 'daily-life'],
    content: `Le petit-déjeuner français est simple et sucré. C'est très différent du petit-déjeuner anglais ou américain.

Le matin, les Français boivent du café ou du thé. Le café au lait dans un grand bol est traditionnel. Les enfants boivent du chocolat chaud.

Le pain est essentiel. On mange des tartines de baguette avec du beurre et de la confiture. Le beurre doit être de bonne qualité, et la confiture maison est préférée.

Les croissants et les pains au chocolat sont réservés au weekend ou aux occasions spéciales. En semaine, c'est trop cher et trop calorique.

Les Français ne mangent pas de salé le matin. Pas d'œufs, pas de bacon, pas de saucisses. Cela semble étrange aux étrangers.

Le petit-déjeuner français est rapide. On mange en 15 minutes, souvent debout dans la cuisine. Le dimanche, on prend plus de temps.

Aujourd'hui, les habitudes changent. Certains Français sautent le petit-déjeuner. D'autres mangent des céréales ou des yaourts. Mais la tartine reste la tradition.`,
  },
  {
    id: '64',
    title: 'Aimé Césaire et la négritude',
    subtitle: 'Martinique\'s great poet and politician',
    difficulty: 'university',
    estimatedMinutes: 13,
    category: 'literature',
    region: 'martinique',
    tags: ['poetry', 'politics', 'colonialism', 'identity'],
    content: `Aimé Césaire (1913-2008) est l'une des figures intellectuelles majeures du XXe siècle. Poète, dramaturge et homme politique martiniquais, il a cofondé le mouvement de la négritude et a profondément marqué la pensée anticoloniale.

Né à Basse-Pointe, en Martinique, Césaire a poursuivi ses études à Paris, à l'École normale supérieure. C'est là qu'il a rencontré Léopold Sédar Senghor et Léon-Gontran Damas, avec qui il a fondé la négritude.

La négritude est un mouvement littéraire et politique qui affirme la valeur des cultures noires face au mépris colonial. Le terme, inventé par Césaire, retourne le stigmate : le mot « nègre », utilisé comme insulte, devient un étendard de fierté.

Le « Cahier d'un retour au pays natal » (1939) est l'œuvre fondatrice de Césaire. Ce long poème épique raconte le retour du poète vers son île natale et sa prise de conscience identitaire. « Ma négritude n'est pas une pierre, sa surdité ruée contre la clameur du jour / ma négritude n'est pas une taie d'eau morte sur l'œil mort de la terre. »

L'écriture de Césaire est d'une puissance volcanique. Il mêle surréalisme et engagement politique, images oniriques et dénonciation de l'oppression. Son style est baroque, exubérant, inventif dans son vocabulaire.

En 1945, Césaire est élu maire de Fort-de-France et député de la Martinique, fonctions qu'il exercera pendant des décennies. Il milite pour la départementalisation de la Martinique en 1946, avant de devenir critique de l'assimilation.

« Discours sur le colonialisme » (1950) est son texte politique le plus influent. Il y dénonce avec violence la barbarie coloniale et l'hypocrisie de l'humanisme européen. « Une civilisation qui ruse avec ses principes est une civilisation moribonde. »

Le théâtre de Césaire prolonge son engagement. « La Tragédie du roi Christophe » (1963) évoque l'indépendance haïtienne. « Une saison au Congo » (1966) raconte l'assassinat de Patrice Lumumba.

L'héritage de Césaire est immense. Il a influencé des penseurs comme Frantz Fanon, Édouard Glissant et de nombreux autres. En 2011, ses cendres ont été transférées au Panthéon, hommage de la République à ce poète qui l'avait tant critiquée.

La question de la décolonisation reste au cœur de l'actualité. Les textes de Césaire continuent d'inspirer les mouvements pour la justice raciale et la reconnaissance des crimes coloniaux.`,
  },
  {
    id: '65',
    title: 'Commander un taxi',
    subtitle: 'Taking a taxi in France',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    tags: ['transport', 'travel', 'vocabulary'],
    content: `— Taxi ! Vous êtes libre ?

— Oui, montez. Où allez-vous ?

— À la gare Montparnasse, s'il vous plaît.

— D'accord. Vous êtes pressé ?

— Un peu. Mon train part dans trente minutes.

— Ne vous inquiétez pas, on a le temps.

[Pendant le trajet]

— Il y a beaucoup de circulation aujourd'hui.

— Oui, c'est toujours comme ça le matin.

[À l'arrivée]

— Voilà, nous sommes arrivés.

— C'est combien ?

— Quinze euros.

— Tenez, gardez la monnaie.

— Merci beaucoup ! Bon voyage !`,
  },
  {
    id: '66',
    title: 'Les horloges suisses',
    subtitle: 'The art of Swiss watchmaking',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'culture',
    region: 'switzerland',
    tags: ['watches', 'craftsmanship', 'industry', 'tradition'],
    content: `L'horlogerie suisse est réputée dans le monde entier pour sa précision et sa qualité. Cette tradition remonte au XVIe siècle et reste un pilier de l'économie et de l'identité suisse.

L'histoire commence avec les huguenots français. Ces protestants persécutés se sont réfugiés à Genève et ont apporté leur savoir-faire horloger. La région du Jura est devenue le berceau de l'industrie.

Les montres suisses sont synonymes de perfection mécanique. Un mouvement de haute horlogerie peut contenir plus de 300 pièces, assemblées à la main. Certains horlogers passent des mois sur une seule montre.

Les grandes marques suisses sont des icônes de luxe : Rolex, Patek Philippe, Omega, TAG Heuer, Tissot. Chaque marque a son histoire et son style. Posséder une montre suisse est un symbole de réussite.

La vallée de Joux, dans le canton de Vaud, est le cœur de la haute horlogerie. Des villages comme Le Brassus et Le Sentier abritent les ateliers des plus grands noms. L'air y est pur, ce qui était important pour le travail de précision.

Le « Swiss Made » est protégé par la loi. Pour porter cette mention, une montre doit répondre à des critères stricts : mouvement suisse, assemblage en Suisse, contrôle final en Suisse.

L'industrie a connu des crises. Dans les années 1970, les montres à quartz japonaises ont menacé l'horlogerie traditionnelle. La Suisse a répondu avec la Swatch, montre colorée et abordable, qui a sauvé le secteur.

Aujourd'hui, l'horlogerie suisse reste florissante. Elle emploie environ 60 000 personnes et exporte pour plus de 20 milliards de francs par an. C'est un exemple unique d'industrie de luxe ancrée dans un savoir-faire séculaire.`,
  },
  {
    id: '67',
    title: 'La fondue suisse',
    subtitle: 'Switzerland\'s national dish',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'switzerland',
    tags: ['cuisine', 'cheese', 'tradition', 'Alps'],
    content: `La fondue est le plat national de la Suisse. Ce fromage fondu dans lequel on trempe du pain est un symbole de convivialité.

La vraie fondue suisse se prépare avec deux fromages : le gruyère et le vacherin fribourgeois. On les fait fondre avec du vin blanc et une gousse d'ail. Un peu de kirsch ajoute du goût.

Le caquelon, le pot en terre cuite, est posé sur un réchaud. Le fromage doit rester chaud mais pas trop bouillant. On utilise de longues fourchettes pour tremper les morceaux de pain.

Il existe une tradition : si vous perdez votre pain dans le fromage, vous devez payer une tournée de vin blanc ! Les Suisses prennent cela très au sérieux.

La fondue est un plat d'hiver, parfait après une journée de ski. On la mange dans les restaurants de montagne, les chalets et les appartements. C'est un repas simple qui réunit les amis.

En Suisse, on boit du thé ou du vin blanc avec la fondue, jamais d'eau froide. Les Suisses croient que l'eau fait durcir le fromage dans l'estomac !

La fondue au chocolat existe aussi. On trempe des fruits dans du chocolat fondu. C'est un dessert populaire dans les stations de ski.`,
  },
  {
    id: '68',
    title: 'Le système éducatif français',
    subtitle: 'Understanding French schools',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'culture',
    region: 'france',
    tags: ['education', 'school', 'system', 'society'],
    content: `Le système éducatif français est centralisé et uniforme. De Lille à Marseille, tous les élèves suivent les mêmes programmes, passent les mêmes examens.

L'école maternelle accueille les enfants de 3 à 6 ans. Ce n'est pas une garderie : on y apprend les bases de la lecture, de l'écriture et du calcul. C'est obligatoire depuis 2019.

L'école élémentaire dure cinq ans, du CP au CM2. Les enfants apprennent à lire, écrire et compter. Ils étudient aussi l'histoire, la géographie, les sciences et une langue étrangère.

Le collège accueille les élèves de 11 à 15 ans. Ils passent par la sixième, cinquième, quatrième et troisième. À la fin, ils passent le brevet des collèges.

Après le collège, les élèves vont au lycée général, technologique ou professionnel. Le lycée dure trois ans : seconde, première et terminale.

Le baccalauréat, ou « bac », est l'examen qui termine le lycée. C'est un diplôme national très important. Sans le bac, il est difficile de continuer ses études ou de trouver un bon emploi.

Le système français est souvent critiqué pour sa rigidité et son élitisme. Les notes sont importantes dès le plus jeune âge. La pression scolaire est forte.

Malgré ses défauts, l'école française forme des citoyens cultivés. Les valeurs républicaines — liberté, égalité, fraternité — sont enseignées à tous. La laïcité est un principe fondamental.`,
  },
  {
    id: '69',
    title: 'Acheter des vêtements',
    subtitle: 'Shopping for clothes',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'france',
    tags: ['shopping', 'clothes', 'vocabulary'],
    content: `— Bonjour, je peux vous aider ?

— Oui, je cherche une robe pour une fête.

— Quelle taille faites-vous ?

— Je fais du 38.

— Voici quelques modèles. Cette robe noire est très élégante.

— Elle est jolie. Je peux l'essayer ?

— Bien sûr, la cabine d'essayage est là-bas.

[Après l'essayage]

— Alors, ça vous va ?

— C'est un peu serré. Vous l'avez en 40 ?

— Oui, voilà. Essayez celle-ci.

[Après le deuxième essayage]

— Parfait ! Elle me va très bien. C'est combien ?

— 79 euros. Elle est en promotion cette semaine.

— D'accord, je la prends. Vous acceptez la carte ?

— Oui, bien sûr.`,
  },
  {
    id: '70',
    title: 'La Révolution française',
    subtitle: 'The birth of modern democracy',
    difficulty: 'hard',
    estimatedMinutes: 11,
    category: 'history',
    region: 'france',
    tags: ['revolution', 'politics', 'history', 'democracy'],
    content: `La Révolution française de 1789 est l'un des événements les plus importants de l'histoire mondiale. Elle a renversé la monarchie absolue et posé les fondements de la démocratie moderne.

La France de 1789 était en crise. Le royaume était endetté par les guerres et le train de vie de la cour. Le peuple souffrait de la faim et des impôts. La société était divisée en trois ordres : le clergé, la noblesse et le tiers état, ce dernier payant presque tous les impôts.

Le 14 juillet 1789, le peuple de Paris a pris d'assaut la Bastille, prison symbole du pouvoir royal. Cette date est devenue la fête nationale française.

Le 26 août 1789, l'Assemblée nationale a adopté la Déclaration des droits de l'homme et du citoyen. « Les hommes naissent et demeurent libres et égaux en droits. » Ce texte reste le fondement des droits humains.

La Révolution a aboli les privilèges de la noblesse et du clergé. Elle a établi l'égalité devant la loi et l'impôt. Elle a séparé l'Église et l'État.

Mais la Révolution a aussi connu des excès. La Terreur (1793-1794) a vu des milliers d'exécutions. Le roi Louis XVI et la reine Marie-Antoinette ont été guillotinés. Les révolutionnaires se sont entre-tués.

Napoléon Bonaparte a mis fin à la période révolutionnaire en prenant le pouvoir en 1799. Mais il a conservé et exporté les acquis de la Révolution dans toute l'Europe.

L'héritage de la Révolution est immense. Les concepts de citoyenneté, de souveraineté populaire, de droits universels viennent de 1789. Les révolutions du XIXe siècle, de l'Amérique latine à l'Europe, se sont inspirées de la Révolution française.

Aujourd'hui encore, la Révolution française reste un sujet de débat. Certains célèbrent la libération du peuple. D'autres critiquent la violence et le chaos. C'est le signe que cet événement continue de façonner notre présent.`,
  },
  {
    id: '71',
    title: 'Les fables de La Fontaine',
    subtitle: 'Classic French moral tales',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'literature',
    region: 'france',
    tags: ['fables', 'poetry', 'morality', 'classics'],
    content: `Jean de La Fontaine (1621-1695) est l'auteur des fables les plus célèbres de la littérature française. Ces courts récits en vers, mettant en scène des animaux, transmettent des leçons de vie qui restent actuelles.

La Fontaine a publié ses Fables entre 1668 et 1694. Il s'est inspiré d'Ésope, un auteur grec de l'Antiquité, mais a transformé ces histoires simples en chefs-d'œuvre poétiques.

« Le Corbeau et le Renard » est peut-être la fable la plus connue. Un corbeau tient un fromage dans son bec. Le renard le flatte pour qu'il chante et laisse tomber le fromage. La morale : méfiez-vous des flatteurs.

« La Cigale et la Fourmi » oppose l'artiste insouciante à la travailleuse prévoyante. La cigale chante tout l'été tandis que la fourmi amasse des provisions. L'hiver venu, la cigale se retrouve démunie.

« Le Lièvre et la Tortue » montre qu'il ne faut pas mépriser les plus lents. Le lièvre, sûr de gagner, s'endort pendant la course. La tortue, persévérante, arrive première.

Chaque fable contient une morale, souvent exprimée à la fin. « Rien ne sert de courir, il faut partir à point. » Ces phrases sont devenues des proverbes que tous les Français connaissent.

Les fables de La Fontaine sont enseignées à l'école dès le primaire. Les enfants les apprennent par cœur et les récitent. C'est un passage obligé de l'éducation française.

Au-delà de leur apparente simplicité, les fables sont des œuvres subtiles. La Fontaine critique la société de son temps — la cour, les puissants, l'injustice — sous le masque des animaux.`,
  },
  {
    id: '72',
    title: 'Le cinéma français',
    subtitle: 'France\'s film industry',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'culture',
    region: 'france',
    tags: ['cinema', 'art', 'industry', 'culture'],
    content: `Le cinéma est né en France. En 1895, les frères Lumière ont présenté leur invention à Paris : le cinématographe. Depuis, la France est restée une grande nation du cinéma.

Le cinéma français a toujours été différent d'Hollywood. Les réalisateurs français privilégient souvent le caractère des personnages à l'action spectaculaire. Les dialogues sont importants. L'ambiance compte autant que l'histoire.

La Nouvelle Vague des années 1960 a révolutionné le cinéma mondial. Des réalisateurs comme Jean-Luc Godard, François Truffaut et Agnès Varda ont inventé un nouveau langage filmique. Ils tournaient dans la rue, avec peu de moyens, mais avec beaucoup d'audace.

Le Festival de Cannes est le plus prestigieux du monde. Chaque année en mai, stars et réalisateurs montent les marches du Palais des Festivals. La Palme d'or récompense le meilleur film.

Les acteurs français sont des stars nationales. Jean Gabin, Alain Delon, Catherine Deneuve, Gérard Depardieu, Marion Cotillard... Leurs visages sont connus de tous les Français.

Le cinéma français bénéficie d'un système de soutien public unique. L'« exception culturelle » protège la production nationale de la domination américaine. Chaque ticket de cinéma finance les films français de demain.

Aujourd'hui, le cinéma français reste créatif et divers. Des comédies populaires aux films d'auteur, des thrillers aux documentaires, la production est riche. Environ 300 films français sortent chaque année.`,
  },
  {
    id: '73',
    title: 'Le Sénégal et le football',
    subtitle: 'A nation passionate about soccer',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'sports',
    region: 'senegal',
    tags: ['football', 'sports', 'passion', 'pride'],
    content: `Le football est une passion nationale au Sénégal. Ce sport unit tout le pays, des villages aux grandes villes.

L'équipe nationale, les « Lions de la Téranga », est une fierté pour les Sénégalais. En 2002, le Sénégal a créé la surprise en battant la France lors de la Coupe du monde. Toute l'Afrique a célébré cette victoire historique.

En 2022, le Sénégal a remporté la Coupe d'Afrique des Nations pour la première fois. C'était un moment d'immense joie. Les rues de Dakar ont explosé de bonheur. Le pays entier faisait la fête.

Les stars sénégalaises jouent dans les meilleurs clubs européens. Sadio Mané est devenu une icône mondiale. Il a gagné la Ligue des Champions avec Liverpool et le Ballon d'or africain plusieurs fois.

Au Sénégal, les enfants jouent au football partout : sur la plage, dans les ruelles, sur les terrains vagues. Beaucoup rêvent de devenir professionnels et de jouer en Europe.

Le football féminin se développe aussi. Les « Lionnes » font de plus en plus parler d'elles. Des joueuses sénégalaises évoluent dans des clubs français.

Les matchs importants rassemblent tout le pays devant les télévisions. Les familles, les amis, les voisins regardent ensemble. C'est un moment de communion nationale.`,
  },
  {
    id: '74',
    title: 'La médecine traditionnelle au Cameroun',
    subtitle: 'Traditional healing practices',
    difficulty: 'hard',
    estimatedMinutes: 8,
    category: 'culture',
    region: 'cameroon',
    tags: ['medicine', 'tradition', 'plants', 'health'],
    content: `La médecine traditionnelle occupe une place importante au Cameroun. Malgré le développement de la médecine moderne, beaucoup de Camerounais consultent d'abord les guérisseurs traditionnels.

Les tradipraticiens utilisent les plantes médicinales de la forêt équatoriale. Le Cameroun possède une biodiversité extraordinaire avec des milliers d'espèces végétales. Certaines ont des propriétés médicinales reconnues par la science.

Le savoir des guérisseurs se transmet de génération en génération, souvent au sein des familles. L'apprentissage dure des années. Le guérisseur doit connaître les plantes, les dosages, les préparations, mais aussi les prières et les rituels qui accompagnent les soins.

La médecine traditionnelle africaine ne sépare pas le corps de l'esprit. Une maladie peut avoir une cause physique, mais aussi spirituelle. Le guérisseur traite l'ensemble : le corps, l'âme et les relations sociales du patient.

Certaines pratiques sont efficaces et ont été validées par la recherche. L'artemisia, utilisée depuis des siècles en Afrique, est aujourd'hui la base de médicaments antipaludéens. D'autres plantes sont étudiées pour leurs propriétés anti-cancer.

Mais la médecine traditionnelle a aussi ses limites. Certains guérisseurs sont des charlatans. Des pratiques peuvent être dangereuses. Le refus de la médecine moderne peut retarder des traitements vitaux.

Le gouvernement camerounais essaie d'encadrer la médecine traditionnelle. Des initiatives visent à former les tradipraticiens, à certifier leurs compétences, à intégrer leurs savoirs dans le système de santé.

L'avenir est peut-être dans la complémentarité. La médecine moderne pour les urgences et les maladies graves. La médecine traditionnelle pour la prévention, le bien-être et les soins de base.`,
  },
  {
    id: '75',
    title: 'Le climat de la France',
    subtitle: 'Weather patterns across France',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'article',
    region: 'france',
    tags: ['weather', 'geography', 'climate', 'regions'],
    content: `La France a plusieurs types de climat selon les régions. Cela explique la diversité des paysages et des modes de vie.

Le nord et l'ouest ont un climat océanique. Les étés sont doux et les hivers sont frais. Il pleut souvent mais rarement très fort. Paris a ce type de climat.

Le sud a un climat méditerranéen. Les étés sont chauds et secs. Les hivers sont doux avec peu de neige. Le soleil brille plus de 300 jours par an. C'est la région de Nice et Marseille.

L'est a un climat continental. Les étés sont chauds et les hivers peuvent être très froids. Les différences de température entre les saisons sont importantes. Strasbourg connaît ce climat.

Les montagnes — Alpes, Pyrénées, Massif central — ont un climat montagnard. Il fait froid et il neige beaucoup en hiver. L'été, les températures sont agréables.

La météo est un sujet de conversation courant en France. Les Français parlent souvent du temps qu'il fait. « Il fait beau aujourd'hui ! » ou « Quel temps de chien ! »

Le changement climatique affecte la France. Les canicules sont plus fréquentes. Les vendanges commencent plus tôt. La neige se fait rare dans certaines stations de ski.`,
  },
  {
    id: '76',
    title: 'Léopold Sédar Senghor',
    subtitle: 'Poet and president of Senegal',
    difficulty: 'university',
    estimatedMinutes: 12,
    category: 'literature',
    region: 'senegal',
    tags: ['poetry', 'politics', 'negritude', 'francophone'],
    content: `Léopold Sédar Senghor (1906-2001) incarne une figure unique : celle du poète devenu chef d'État. Premier président du Sénégal indépendant, il est aussi l'un des plus grands poètes francophones du XXe siècle.

Né dans une famille bourgeoise de la région de Joal, Senghor a reçu une éducation à la fois traditionnelle et française. Cette double culture nourrit toute son œuvre.

Étudiant brillant à Paris dans les années 1930, Senghor rencontre Aimé Césaire avec qui il fonde le mouvement de la négritude. Ce mouvement affirme la valeur des cultures noires face au racisme colonial.

La poésie de Senghor célèbre l'Afrique avec lyrisme. Il chante les paysages de son enfance, les femmes noires, les masques et les rythmes. « Femme nue, femme noire / Vêtue de ta couleur qui est vie, de ta forme qui est beauté ! »

Mais Senghor refuse l'opposition simpliste entre civilisations. Il prône un « métissage culturel », une rencontre féconde entre l'Afrique et l'Europe. Sa francophonie est un humanisme universaliste.

En 1960, Senghor devient le premier président du Sénégal indépendant. Il gouverne pendant vingt ans, instaurant un socialisme africain modéré. Le Sénégal reste stable et démocratique, une exception en Afrique.

Son pouvoir n'est pas sans critiques. Senghor réprime parfois l'opposition. Certains lui reprochent sa francophilie excessive, son éloignement des réalités populaires.

En 1980, Senghor quitte volontairement le pouvoir — fait rare pour un dirigeant africain. Il se consacre à l'Académie française, dont il devient le premier Africain membre, en 1983.

L'héritage de Senghor est complexe. Comme poète, il a donné une voix à l'Afrique en français. Comme penseur, il a formulé une philosophie du dialogue des cultures. Comme homme politique, il a maintenu le Sénégal sur la voie de la démocratie.

La négritude a été critiquée comme essentialiste, réduisant les Noirs à des caractéristiques supposées naturelles. Senghor a répondu que la négritude n'était pas biologique mais culturelle, une façon d'être au monde.`,
  },
  {
    id: '77',
    title: 'Les crêpes bretonnes',
    subtitle: 'Brittany\'s famous thin pancakes',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'france',
    tags: ['cuisine', 'Brittany', 'tradition'],
    content: `Les crêpes sont une spécialité de la Bretagne, dans l'ouest de la France. On en mange depuis des siècles dans cette région.

Il existe deux types de crêpes bretonnes. Les crêpes sucrées sont faites avec de la farine de froment. On les garnit de sucre, de confiture, de chocolat ou de fruits.

Les galettes sont salées et faites avec de la farine de sarrasin, appelée « blé noir ». La garniture classique est jambon, fromage et œuf. On appelle cela une galette complète.

En Bretagne, les crêperies sont partout. C'est une tradition de manger des crêpes le vendredi soir. On boit du cidre avec les galettes.

Faire une bonne crêpe demande du savoir-faire. La pâte doit reposer plusieurs heures. Le bilig, la plaque de cuisson, doit être très chaud. On étale la pâte avec une rozell, une sorte de râteau.

Les crêpes sont parfaites pour un repas rapide et pas cher. On peut les manger dans une crêperie ou à emporter dans la rue.

À Paris et dans toute la France, les crêperies bretonnes sont populaires. Mais les Bretons disent que les meilleures crêpes se trouvent en Bretagne, bien sûr !`,
  },
  {
    id: '78',
    title: 'Louer un appartement',
    subtitle: 'Renting an apartment in France',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'dialogue',
    region: 'france',
    tags: ['housing', 'renting', 'daily-life'],
    content: `— Bonjour, j'appelle pour l'appartement en location.

— Bonjour. Oui, l'appartement de la rue Victor Hugo ?

— C'est ça. Il est toujours disponible ?

— Oui. C'est un deux-pièces de 45 mètres carrés.

— Quel est le loyer ?

— 850 euros par mois, charges comprises.

— Il y a un balcon ?

— Non, mais il y a une grande fenêtre avec vue sur la cour.

— L'appartement est meublé ?

— Non, il est vide. Mais la cuisine est équipée.

— Je peux visiter ?

— Bien sûr. Demain à 14 heures, ça vous va ?

— Parfait. Qu'est-ce que je dois apporter ?

— Vos trois dernières fiches de paie et une pièce d'identité.

— D'accord. À demain alors.

— À demain. Au revoir.`,
  },
  {
    id: '79',
    title: 'Le café en France',
    subtitle: 'French coffee culture',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'culture',
    region: 'france',
    tags: ['coffee', 'cafe', 'daily-life', 'tradition'],
    content: `Le café fait partie de la vie quotidienne des Français. On en boit le matin au petit-déjeuner, après le déjeuner, et parfois dans l'après-midi.

En France, quand vous commandez « un café », vous recevez un petit expresso. C'est fort et servi dans une petite tasse. Pour un café plus long, demandez « un allongé ».

Le café crème est un expresso avec du lait chaud et de la mousse. On le boit surtout le matin. Les Français trouvent bizarre de boire du café au lait après midi.

Les cafés français sont plus que des endroits pour boire. Ce sont des lieux sociaux. On y lit le journal, on y retrouve des amis, on y regarde les gens passer.

Les terrasses sont essentielles. Dès qu'il fait beau, les Français s'installent dehors. Les chaises sont tournées vers la rue pour observer le spectacle urbain.

Le café décaféiné existe mais n'est pas très populaire. Les Français préfèrent le « vrai » café avec la caféine.

Le prix du café varie beaucoup. Au comptoir, c'est moins cher qu'en terrasse. Dans les quartiers touristiques, les prix sont plus élevés.`,
  },
  {
    id: '80',
    title: 'Le reggae ivoirien : Alpha Blondy',
    subtitle: 'Ivory Coast\'s reggae legend',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'ivory-coast',
    tags: ['music', 'reggae', 'artist', 'culture'],
    content: `Alpha Blondy est l'un des plus grands artistes reggae du monde. Ce chanteur ivoirien a popularisé le reggae en Afrique et au-delà.

Né Seydou Koné en 1953 à Dimbokro, Alpha Blondy a découvert le reggae et Bob Marley pendant ses études aux États-Unis. De retour en Côte d'Ivoire, il a décidé de chanter en anglais, en français et en dioula.

Son premier album, « Jah Glory », est sorti en 1982. La chanson « Brigadier Sabari » a été un énorme succès en Afrique. Elle racontait ses problèmes avec les autorités ivoiriennes.

Alpha Blondy est connu pour ses messages spirituels et politiques. Ses chansons parlent de paix, d'amour et de justice. Il critique les dictateurs africains et appelle à l'unité du continent.

La musique d'Alpha Blondy mélange le reggae jamaïcain avec des rythmes africains. Il chante dans plusieurs langues, parfois dans la même chanson. Ses concerts sont des fêtes géantes.

Pendant la crise ivoirienne des années 2000, Alpha Blondy a appelé à la réconciliation. Il a organisé des concerts pour la paix. Sa voix comptait dans un pays déchiré.

Aujourd'hui encore, Alpha Blondy continue de tourner dans le monde entier. Il reste un symbole de la culture ivoirienne et de la capacité de la musique à rapprocher les peuples.`,
  },
  {
    id: '81',
    title: 'La crise climatique et la France',
    subtitle: 'Climate change impacts in France',
    difficulty: 'hard',
    estimatedMinutes: 9,
    category: 'science',
    region: 'france',
    tags: ['climate', 'environment', 'science', 'society'],
    content: `Le changement climatique affecte la France de manière visible et mesurable. Les températures augmentent, les événements extrêmes se multiplient, les écosystèmes se transforment.

La température moyenne en France a augmenté de 1,7°C depuis le début du XXe siècle, plus que la moyenne mondiale. Les étés deviennent de plus en plus chauds. La canicule de 2003 a causé plus de 15 000 décès.

Les vagues de chaleur sont maintenant deux fois plus fréquentes qu'il y a trente ans. En 2019 et 2022, des records de température ont été battus dans plusieurs régions. Certaines villes ont dépassé 45°C.

Les glaciers alpins fondent rapidement. Le glacier de la Mer de Glace, le plus grand de France, recule de plusieurs mètres par an. Les stations de ski de basse altitude peinent à maintenir leur activité.

La viticulture est touchée. Les vendanges ont lieu un mois plus tôt qu'il y a cinquante ans. Certains cépages traditionnels ne s'adaptent plus aux nouvelles conditions. Des vignerons expérimentent des variétés méditerranéennes dans le nord.

Les forêts souffrent. Les sécheresses répétées affaiblissent les arbres et favorisent les incendies. En 2022, des feux de forêt d'une ampleur inédite ont ravagé le sud-ouest.

La biodiversité décline. Certaines espèces d'oiseaux migrateurs ne migrent plus. Des insectes méditerranéens colonisent le nord. Les coraux de Méditerranée blanchissent.

La France s'est engagée à atteindre la neutralité carbone en 2050. Des politiques de transition énergétique sont mises en place : développement des renouvelables, rénovation des bâtiments, mobilité électrique.

Mais les objectifs sont difficiles à atteindre. Les émissions françaises ne baissent pas assez vite. La société se divise sur les mesures à prendre. Le mouvement des gilets jaunes est né d'une taxe carbone sur les carburants.

L'adaptation devient nécessaire. Les villes repensent leur urbanisme pour lutter contre les îlots de chaleur. L'agriculture développe de nouvelles pratiques. Les citoyens changent leurs habitudes.`,
  },
  {
    id: '82',
    title: 'La musique classique française',
    subtitle: 'Great French composers',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'france',
    tags: ['classical', 'music', 'composers', 'culture'],
    content: `La France a une riche tradition de musique classique. Des compositeurs français ont marqué l'histoire de la musique occidentale.

Au XIXe siècle, Hector Berlioz a révolutionné l'orchestre. Sa « Symphonie fantastique » raconte une histoire avec de la musique. Il a inventé de nouvelles façons d'utiliser les instruments.

Claude Debussy est peut-être le compositeur français le plus célèbre. Sa musique est impressionniste, comme les tableaux de Monet. « Clair de lune » et « La Mer » évoquent des ambiances plutôt que des histoires précises.

Maurice Ravel est connu pour son « Boléro », un morceau hypnotique où le même thème se répète avec des instruments différents. Son orchestration est d'une précision extraordinaire.

Gabriel Fauré a composé de magnifiques mélodies et un requiem apaisant. Sa musique est élégante et délicate. Il a formé une génération de compositeurs au Conservatoire de Paris.

Camille Saint-Saëns a écrit dans tous les genres. Son « Carnaval des animaux » est populaire auprès des enfants. Chaque morceau représente un animal différent.

Erik Satie était un original. Ses « Gymnopédies » sont simples et mélancoliques. Il a inspiré les musiciens d'avant-garde du XXe siècle.

Aujourd'hui, la musique classique reste vivante en France. L'Opéra de Paris, l'Orchestre de Paris et de nombreux festivals attirent des publics du monde entier.`,
  },
  {
    id: '83',
    title: 'Le joual québécois',
    subtitle: 'Quebec\'s working-class dialect',
    difficulty: 'hard',
    estimatedMinutes: 8,
    category: 'culture',
    region: 'quebec',
    tags: ['language', 'dialect', 'identity', 'society'],
    content: `Le joual est une forme populaire du français québécois, née dans les quartiers ouvriers de Montréal. Ce parler a été longtemps méprisé avant de devenir un symbole de l'identité québécoise.

Le mot « joual » est une déformation de « cheval ». Cette prononciation caractéristique — « chwal » devient « joual » — illustre les particularités de ce parler.

Le joual se caractérise par une prononciation relâchée, des anglicismes nombreux et un vocabulaire distinct. « Icitte » pour « ici », « tiguidou » pour « d'accord », « pogner » pour « attraper ».

Dans les années 1960, le joual était considéré comme un français « abâtardi ». Les intellectuels le critiquaient comme un signe de colonisation culturelle. Les écoles essayaient de l'éliminer.

Le roman « Les Belles-Sœurs » de Michel Tremblay (1968) a tout changé. Cette pièce de théâtre, entièrement écrite en joual, a choqué et fasciné. Elle montrait la réalité des femmes des quartiers populaires de Montréal.

Le joual est alors devenu un outil de revendication identitaire. Parler joual, c'était refuser l'assimilation, affirmer sa différence face à la France et au Canada anglais.

Aujourd'hui, le débat continue. Certains défendent le joual comme patrimoine culturel. D'autres estiment qu'il faut enseigner un français plus international.

Le québécois actuel est influencé par le joual mais s'en distingue. Les jeunes Québécois mélangent français standard, québécismes et anglicismes dans un parler vivant et créatif.`,
  },
  {
    id: '84',
    title: 'L\'impressionnisme',
    subtitle: 'The art movement that changed painting',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'culture',
    region: 'france',
    tags: ['art', 'painting', 'history', 'culture'],
    content: `L'impressionnisme est un mouvement artistique né en France dans les années 1860. Cette révolution a changé notre façon de voir et de représenter le monde.

Avant l'impressionnisme, les peintres travaillaient en atelier et cherchaient la perfection technique. Les sujets étaient historiques, mythologiques ou religieux. Les couleurs étaient sombres.

Les impressionnistes ont tout changé. Ils peignaient en plein air, directement devant le paysage. Ils capturaient la lumière changeante, les reflets sur l'eau, les nuages qui passent.

Le nom « impressionnisme » vient d'un tableau de Claude Monet : « Impression, soleil levant ». Un critique l'a utilisé de façon moqueuse, mais les artistes ont adopté le terme.

Les grands noms sont célèbres : Monet, Renoir, Degas, Pissarro, Sisley, Berthe Morisot. Chacun avait son style. Monet peignait la nature, Renoir les gens heureux, Degas les danseuses.

La technique impressionniste est reconnaissable : petites touches de couleur pure qui se mélangent dans l'œil du spectateur. De près, on voit les coups de pinceau. De loin, l'image apparaît.

Le public et les critiques ont d'abord rejeté ces tableaux. Ils les trouvaient inachevés, brouillons. Mais aujourd'hui, les impressionnistes sont parmi les artistes les plus aimés au monde.

Le musée d'Orsay à Paris possède la plus grande collection de peintures impressionnistes. Des millions de visiteurs viennent voir ces chefs-d'œuvre chaque année.`,
  },
  {
    id: '85',
    title: 'Le transport au Sénégal',
    subtitle: 'Getting around in Senegal',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'travel',
    region: 'senegal',
    tags: ['transport', 'travel', 'daily-life'],
    content: `Se déplacer au Sénégal est une aventure. Les moyens de transport sont variés et colorés.

Les « cars rapides » sont des minibus peints de couleurs vives. Ils circulent dans les villes et relient les quartiers. On monte et on descend où on veut. Le prix est très bas.

Les « Ndiaga Ndiaye » sont de plus grands bus pour les longues distances. Ils portent le nom de leur créateur. On les trouve à la gare routière de Dakar.

Les taxis sont jaunes et noirs. Les compteurs ne marchent pas toujours, alors il faut négocier le prix avant de monter. C'est une habitude au Sénégal.

Le « clando » est un taxi clandestin, une voiture privée qui fait le taxi. C'est moins cher mais pas officiel.

Les « pirogues » sont des bateaux traditionnels. On les utilise pour aller sur les îles et pour pêcher. Elles sont peintes de couleurs vives.

Le TER (Train Express Régional) est un nouveau train moderne entre Dakar et Diamniadio. Il est rapide et climatisé, très différent des anciens transports.

Circuler au Sénégal demande de la patience. Il y a beaucoup de circulation à Dakar. Mais c'est aussi une façon de vivre des expériences et de rencontrer des gens.`,
  },
  {
    id: '86',
    title: 'Albert Camus et L\'Étranger',
    subtitle: 'The philosophy of the absurd',
    difficulty: 'university',
    estimatedMinutes: 13,
    category: 'literature',
    region: 'france',
    tags: ['literature', 'existentialism', 'philosophy', 'Algeria'],
    content: `Albert Camus (1913-1960) est l'un des écrivains majeurs du XXe siècle. Né en Algérie française, Prix Nobel de littérature en 1957, il a développé une philosophie de l'absurde qui continue d'influencer la pensée contemporaine.

« L'Étranger », publié en 1942, est son roman le plus célèbre. Il raconte l'histoire de Meursault, un employé de bureau à Alger qui tue un Arabe sur une plage et est condamné à mort.

La première phrase est célèbre : « Aujourd'hui, maman est morte. » Cette annonce sans émotion apparente donne le ton. Meursault semble indifférent à tout : la mort de sa mère, sa relation amoureuse, même son propre procès.

Camus illustre dans ce roman le concept d'absurde. L'homme cherche un sens à la vie, mais le monde n'en offre aucun. Cette confrontation entre le désir humain et le silence du monde est l'absurde.

Meursault est condamné moins pour son crime que pour son refus des conventions sociales. Il ne pleure pas à l'enterrement de sa mère, il ne croit pas en Dieu, il refuse de mentir. La société punit son étrangeté.

Le style de Camus est dépouillé, presque journalistique. Les phrases sont courtes, le récit au passé composé (inhabituel en français littéraire). Cette écriture « blanche » renforce le sentiment de détachement.

« Le Mythe de Sisyphe », essai philosophique publié la même année, explicite la pensée de Camus. Face à l'absurde, trois réponses possibles : le suicide, la foi religieuse, ou l'acceptation lucide. Camus choisit la troisième voie.

La question coloniale traverse l'œuvre de Camus sans être vraiment affrontée. L'Arabe de « L'Étranger » n'a pas de nom. Ce silence a été critiqué par des penseurs postcoloniaux.

Pendant la guerre d'Algérie, Camus a refusé de choisir entre la France et l'indépendance algérienne. Sa phrase « Entre la justice et ma mère, je choisis ma mère » a été mal comprise et critiquée.

Camus s'est distingué de Sartre et de l'existentialisme marxiste. Leur rupture publique en 1952 a marqué l'histoire intellectuelle française. Camus refusait la violence révolutionnaire que Sartre justifiait.

L'héritage de Camus reste vivant. Son refus des idéologies, son attachement à la vie malgré l'absurde, son exigence de justice sans violence parlent encore à notre époque.`,
  },
  {
    id: '87',
    title: 'Les jeux vidéo en France',
    subtitle: 'France\'s video game industry',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'culture',
    region: 'france',
    tags: ['games', 'technology', 'industry', 'entertainment'],
    content: `La France est un pays important pour les jeux vidéo. C'est le deuxième marché européen et un centre de création reconnu mondialement.

Ubisoft est le plus grand studio français. Cette entreprise a créé des jeux célèbres comme Assassin's Creed, Just Dance et Far Cry. Ubisoft a des studios partout dans le monde.

Les jeux vidéo français sont souvent originaux et artistiques. Des jeux comme Rayman ou Beyond Good and Evil ont marqué les joueurs par leur créativité.

Les Français jouent beaucoup aux jeux vidéo. Plus de 35 millions de personnes jouent régulièrement. C'est un loisir populaire pour tous les âges.

L'esport se développe en France. Des équipes professionnelles participent à des compétitions internationales. Des joueurs français sont devenus des stars mondiales.

Les écoles de jeux vidéo sont nombreuses. Beaucoup de jeunes Français veulent travailler dans cette industrie. Les métiers sont variés : programmation, graphisme, scénario, son.

Le gouvernement français soutient l'industrie du jeu vidéo. Des aides financières existent pour les studios. Le jeu vidéo est considéré comme une industrie culturelle.`,
  },
  {
    id: '88',
    title: 'La cuisine marocaine',
    subtitle: 'The rich flavors of Morocco',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'food',
    region: 'morocco',
    tags: ['cuisine', 'spices', 'tradition', 'culture'],
    content: `La cuisine marocaine est l'une des plus riches et des plus raffinées du monde. Elle combine des influences arabes, berbères, andalouses et africaines.

Le couscous est le plat national. Ces petites graines de semoule sont servies avec des légumes et de la viande. Chaque vendredi, les familles marocaines mangent le couscous ensemble.

Les épices sont au cœur de la cuisine marocaine. Le cumin, le safran, le gingembre, la cannelle, le paprika créent des saveurs complexes. Le ras el hanout, mélange de dizaines d'épices, est typique.

La pastilla est un plat raffiné. Cette tourte de pâte feuilletée contient du pigeon ou du poulet, des amandes et de la cannelle. Le sucré-salé est une caractéristique de la cuisine marocaine.

Les salades marocaines sont nombreuses et variées. La salade de tomates et concombres, les carottes épicées, les aubergines grillées accompagnent les repas.

Le thé à la menthe est la boisson nationale. On le sert dans de petits verres décorés. Le rituel de préparation est important : on verse de haut pour faire mousser.

Les pâtisseries marocaines sont célèbres. Les cornes de gazelle, les briouates au miel, les chebbakia sont servies lors des fêtes. Elles sont très sucrées et parfumées à l'eau de fleur d'oranger.

Manger au Maroc est une expérience sociale. Les repas sont longs, partagés en famille. L'hospitalité veut qu'on serve toujours plus que les invités ne peuvent manger.`,
  },
  {
    id: '89',
    title: 'Le ski en France',
    subtitle: 'Winter sports in the French Alps',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'sports',
    region: 'france',
    tags: ['skiing', 'winter', 'mountains', 'sports'],
    content: `La France est une grande destination de ski. Les Alpes françaises attirent des millions de skieurs chaque hiver.

Les stations françaises sont parmi les plus grandes du monde. Les Trois Vallées, l'Espace Killy, Paradiski offrent des centaines de kilomètres de pistes.

Chamonix est la station la plus célèbre. Au pied du Mont-Blanc, elle a accueilli les premiers Jeux olympiques d'hiver en 1924. Les skieurs expérimentés adorent ses pentes raides.

Courchevel, Méribel et Val Thorens sont des stations modernes. On y trouve des pistes pour tous les niveaux, des restaurants et des hôtels de luxe.

Le ski est cher en France. Le forfait, la location de matériel et l'hébergement coûtent beaucoup. Mais il existe des options moins chères dans les Pyrénées ou le Massif central.

Les vacances scolaires de février sont dédiées au ski. Les familles françaises partent à la montagne pendant une ou deux semaines. Les stations sont alors très pleines.

Le changement climatique menace les stations de basse altitude. La neige est moins abondante. Certaines stations développent d'autres activités pour l'été.`,
  },
  {
    id: '90',
    title: 'Prendre rendez-vous',
    subtitle: 'Making an appointment',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    tags: ['appointment', 'vocabulary', 'daily-life'],
    content: `— Allô, cabinet du docteur Martin, bonjour.

— Bonjour, je voudrais prendre rendez-vous.

— C'est pour quand ?

— Le plus tôt possible. C'est urgent.

— Voyons... Lundi à 10 heures ?

— Lundi, je travaille. Vous avez quelque chose l'après-midi ?

— Mardi à 15 heures ?

— Parfait, ça me va.

— C'est à quel nom ?

— Dubois, Marie Dubois.

— Vous pouvez épeler ?

— D-U-B-O-I-S.

— Très bien, madame Dubois. Mardi 15 heures.

— Merci beaucoup. Au revoir.

— Au revoir.`,
  },
  {
    id: '91',
    title: 'La mode française',
    subtitle: 'Paris, capital of fashion',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'culture',
    region: 'france',
    tags: ['fashion', 'luxury', 'design', 'industry'],
    content: `Paris est la capitale mondiale de la mode. Depuis le XVIIe siècle, la France dicte les tendances vestimentaires au monde entier.

L'histoire commence avec Louis XIV, qui faisait de Versailles une vitrine du luxe français. Les nobles de toute l'Europe copiaient les styles de la cour française.

Au XIXe siècle, Charles Frederick Worth a inventé la haute couture. Pour la première fois, un créateur signait ses créations et défilait devant des clients. Paris est devenu le centre de cette industrie.

Les grandes maisons françaises sont des symboles du luxe : Chanel, Dior, Louis Vuitton, Hermès, Yves Saint Laurent. Ces marques valent des milliards et habillent les riches du monde entier.

Coco Chanel a révolutionné la mode féminine dans les années 1920. Elle a libéré les femmes du corset et créé des vêtements simples et élégants. La petite robe noire et le tailleur Chanel restent des classiques.

Christian Dior a lancé le « New Look » en 1947. Après les privations de la guerre, ses robes à taille fine et jupes amples célébraient la féminité. Ce style a dominé les années 1950.

Aujourd'hui, la Fashion Week de Paris attire les créateurs du monde entier. Les défilés sont des spectacles, les mannequins sont des célébrités, les places sont très recherchées.

La mode française représente une industrie importante : emplois, exportations, tourisme. Le « made in France » reste synonyme de qualité et d'élégance.`,
  },
  {
    id: '92',
    title: 'L\'histoire de la Martinique',
    subtitle: 'From colonization to today',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'history',
    region: 'martinique',
    tags: ['colonialism', 'slavery', 'history', 'Caribbean'],
    content: `La Martinique a une histoire complexe, marquée par la colonisation, l'esclavage et la lutte pour la dignité. Cette île de 1 100 km² porte les traces de son passé tout en cherchant son avenir.

Les premiers habitants étaient les Arawaks, puis les Caraïbes. Ces peuples amérindiens ont été décimés après l'arrivée des Européens. Quelques traces de leur culture subsistent dans la toponymie et l'artisanat.

En 1635, les Français ont pris possession de l'île. Ils y ont développé la culture de la canne à sucre, qui nécessitait une main-d'œuvre massive. C'est le début de la traite esclavagiste.

Entre le XVIIe et le XIXe siècle, des centaines de milliers d'Africains ont été déportés vers la Martinique. Ils travaillaient dans des conditions inhumaines sur les plantations. Beaucoup mouraient de fatigue, de maladie ou sous les coups.

L'esclavage a été aboli une première fois en 1794, puis rétabli par Napoléon en 1802. L'abolition définitive est venue en 1848, grâce à Victor Schœlcher. Le 22 mai est un jour férié en Martinique.

Après l'abolition, les anciens esclaves sont souvent restés sur les plantations comme travailleurs. Des immigrants indiens sont venus remplacer la main-d'œuvre. La société martiniquaise est restée très inégalitaire.

En 1946, la Martinique est devenue un département français. Cette départementalisation a apporté des droits sociaux mais aussi une dépendance économique envers la métropole.

Depuis, un mouvement indépendantiste existe mais reste minoritaire. La plupart des Martiniquais souhaitent plus d'autonomie tout en gardant les liens avec la France.

La mémoire de l'esclavage est devenue centrale. Le Memorial ACTe en Guadeloupe et les commémorations du 22 mai témoignent d'un travail de mémoire en cours. Les descendants d'esclaves affirment leur histoire et leur identité.`,
  },
  {
    id: '93',
    title: 'Au téléphone',
    subtitle: 'Making a phone call',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'dialogue',
    region: 'france',
    tags: ['phone', 'communication', 'vocabulary'],
    content: `— Allô ?

— Allô, bonjour. Je pourrais parler à Marc, s'il vous plaît ?

— C'est de la part de qui ?

— C'est Sophie, une collègue.

— Un instant, je vous le passe.

[Attente]

— Allô Sophie ?

— Oui, bonjour Marc. Comment vas-tu ?

— Très bien, et toi ?

— Ça va. Je t'appelle pour la réunion de demain.

— Ah oui. À quelle heure ?

— Quatorze heures, salle B.

— D'accord, c'est noté. Autre chose ?

— Non, c'est tout. À demain alors !

— À demain. Bonne fin de journée !

— Merci, toi aussi.`,
  },
  {
    id: '94',
    title: 'L\'architecture haussmannienne',
    subtitle: 'The buildings that define Paris',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'history',
    region: 'france',
    tags: ['architecture', 'Paris', 'history', 'urbanism'],
    content: `Les immeubles haussmanniens définissent le paysage de Paris. Ces bâtiments élégants aux façades uniformes sont le résultat d'une transformation radicale de la ville au XIXe siècle.

Le baron Haussmann a été préfet de la Seine sous Napoléon III, de 1853 à 1870. Il a redessiné Paris, détruisant des quartiers entiers pour créer de larges boulevards.

L'objectif était multiple : améliorer la circulation, apporter l'air et la lumière dans une ville surpeuplée, mais aussi permettre à l'armée de mater plus facilement les révoltes populaires.

Les immeubles haussmanniens suivent des règles strictes. Ils ont généralement six étages. Le rez-de-chaussée est commercial. Les façades sont en pierre de taille, avec des balcons au deuxième et au cinquième étage.

L'intérieur est organisé hiérarchiquement. Le deuxième étage, le « bel étage », était le plus noble. Plus on monte, plus les plafonds sont bas et les appartements modestes. Les chambres de bonne sont sous les toits.

Cette architecture a créé l'harmonie visuelle qui fait le charme de Paris. Les perspectives des grands boulevards, les alignements parfaits, les toits en zinc gris donnent son identité à la capitale.

Aujourd'hui, les immeubles haussmanniens sont très recherchés. Leurs parquets, moulures et cheminées plaisent aux acheteurs. Les prix au mètre carré sont parmi les plus élevés de Paris.

Mais cette architecture pose des défis. Les bâtiments sont anciens et mal isolés. Les rénover en respectant le patrimoine tout en les rendant écologiques est un enjeu majeur.`,
  },
  {
    id: '95',
    title: 'La cuisine québécoise',
    subtitle: 'Traditional dishes of Quebec',
    difficulty: 'easy',
    estimatedMinutes: 5,
    category: 'food',
    region: 'quebec',
    tags: ['cuisine', 'tradition', 'comfort-food'],
    content: `La cuisine québécoise est réconfortante et généreuse. Elle est née pour nourrir les habitants pendant les longs hivers froids.

La tourtière est une tourte à la viande traditionnelle. On la prépare avec du porc, du bœuf et des épices. Chaque famille a sa recette secrète. On la mange surtout à Noël.

Le pâté chinois ressemble au hachis parmentier. C'est une couche de viande hachée, une couche de maïs et une couche de purée de pommes de terre. Simple et délicieux.

La soupe aux pois est un classique d'hiver. On la prépare avec des pois secs, du lard et des légumes. Elle réchauffe après une journée dans le froid.

Les fèves au lard sont des haricots blancs cuits lentement avec du lard et de la mélasse. C'est un plat du petit-déjeuner traditionnel québécois.

Le cipaille (ou « six-pâtes ») est un ragoût en couches avec différentes viandes et de la pâte. C'est un plat de fête qui demande des heures de préparation.

La tarte au sucre et la tarte aux pacanes sont des desserts typiques. Le sirop d'érable est utilisé dans de nombreux desserts.

La cuisine québécoise moderne intègre ces traditions dans une gastronomie créative. Des chefs réinventent les classiques avec des techniques modernes.`,
  },
  {
    id: '96',
    title: 'Les départements d\'outre-mer',
    subtitle: 'France beyond Europe',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'article',
    region: 'france',
    tags: ['overseas', 'geography', 'politics', 'diversity'],
    content: `La France ne se limite pas à l'Hexagone. Les départements et territoires d'outre-mer représentent la France dans le monde entier, de la Caraïbe au Pacifique.

Les DROM (départements et régions d'outre-mer) sont la Martinique, la Guadeloupe, la Guyane, La Réunion et Mayotte. Ce sont des départements français à part entière, avec les mêmes lois et les mêmes droits.

Les COM (collectivités d'outre-mer) ont plus d'autonomie. Ce sont la Polynésie française, Saint-Pierre-et-Miquelon, Wallis-et-Futuna, Saint-Martin et Saint-Barthélemy.

La Nouvelle-Calédonie a un statut spécial. Après trois référendums, elle est restée française mais avec une large autonomie.

Ces territoires donnent à la France une présence mondiale. La zone économique exclusive française est la deuxième du monde grâce aux océans qui entourent ces îles.

Les populations d'outre-mer sont diverses : descendants d'esclaves africains aux Antilles, Amérindiens en Guyane, Kanaks en Nouvelle-Calédonie, Polynésiens à Tahiti.

Les défis sont nombreux : chômage élevé, coût de la vie supérieur à la métropole, éloignement, risques naturels. Les revendications d'autonomie ou d'indépendance existent dans certains territoires.

Pourtant, ces territoires enrichissent la France de leur diversité culturelle, de leur biodiversité et de leur position stratégique.`,
  },
  {
    id: '97',
    title: 'Simone de Beauvoir et le féminisme',
    subtitle: 'The mother of modern feminism',
    difficulty: 'university',
    estimatedMinutes: 12,
    category: 'literature',
    region: 'france',
    tags: ['feminism', 'philosophy', 'existentialism', 'women'],
    content: `Simone de Beauvoir (1908-1986) a transformé la pensée féministe avec son essai « Le Deuxième Sexe », publié en 1949. Cette œuvre monumentale analyse la condition féminine et a inspiré le mouvement de libération des femmes.

Beauvoir était philosophe, romancière et intellectuelle engagée. Compagne de Jean-Paul Sartre pendant cinquante ans, elle a vécu selon ses principes : refus du mariage, liberté sexuelle, indépendance intellectuelle.

« Le Deuxième Sexe » s'ouvre sur une question simple : qu'est-ce qu'une femme ? Beauvoir montre que la féminité n'est pas naturelle mais construite. « On ne naît pas femme, on le devient. »

Cette phrase révolutionnaire signifie que les différences entre hommes et femmes ne sont pas biologiques mais sociales. La société fabrique la femme en l'éduquant à la passivité, à la dépendance, au sacrifice.

Beauvoir analyse comment les mythes, la religion, la psychanalyse ont construit la femme comme « Autre », comme second par rapport à l'homme. Elle critique Freud et son concept d'« envie du pénis ».

La deuxième partie de l'ouvrage décrit les étapes de la vie féminine : l'enfance, la jeune fille, l'initiation sexuelle, le mariage, la maternité, la vieillesse. À chaque étape, les femmes sont enfermées dans des rôles.

Le livre a fait scandale. Le Vatican l'a mis à l'Index. Beaucoup d'hommes (et de femmes) l'ont critiqué avec violence. Mais il a aussi libéré des milliers de lectrices.

Le féminisme de la « deuxième vague » des années 1960-70 s'inspire directement de Beauvoir. Betty Friedan, Kate Millett, et d'autres l'ont citée comme influence majeure.

Les romans de Beauvoir prolongent sa réflexion. « Les Mandarins » (Prix Goncourt 1954) dépeint les intellectuels parisiens de l'après-guerre. « Mémoires d'une jeune fille rangée » raconte son émancipation.

La relation avec Sartre a été scrutée et critiquée. Certaines féministes reprochent à Beauvoir d'être restée dans l'ombre de Sartre. D'autres admirent la façon dont elle a vécu une relation libre et égalitaire.

L'héritage de Beauvoir reste vivant. Ses analyses de la construction sociale du genre fondent les études féministes contemporaines. Son exemple de femme intellectuelle indépendante continue d'inspirer.`,
  },
  {
    id: '98',
    title: 'Les banlieues françaises',
    subtitle: 'Understanding French suburbs',
    difficulty: 'hard',
    estimatedMinutes: 9,
    category: 'article',
    region: 'france',
    tags: ['society', 'suburbs', 'immigration', 'inequality'],
    content: `Les banlieues françaises sont un sujet complexe et souvent mal compris. Ces zones urbaines autour des grandes villes concentrent des problèmes sociaux mais aussi des dynamiques culturelles riches.

Dans les années 1960, la France a construit massivement des logements pour accueillir les travailleurs immigrants et les familles modestes. Ces « grands ensembles » ou « cités » étaient alors modernes et confortables.

Mais avec le temps, ces quartiers ont concentré les populations les plus précaires. Le chômage est élevé, le taux de pauvreté est supérieur à la moyenne nationale. Les services publics sont souvent insuffisants.

Les populations sont diverses. Beaucoup sont issus de l'immigration, principalement du Maghreb et d'Afrique subsaharienne. Mais il y a aussi des Français de toutes origines, unis par des conditions économiques difficiles.

La discrimination est une réalité. Les études montrent qu'un CV avec un nom à consonance arabe ou une adresse en banlieue a moins de chances d'aboutir. Ce racisme systémique alimente la frustration.

Des révoltes urbaines ont éclaté régulièrement : en 2005, les émeutes après la mort de deux adolescents ont touché toute la France. En 2023, la mort de Nahel a provoqué une nouvelle vague de violences.

Pourtant, les banlieues sont aussi des lieux de création. Le rap français est né dans ces quartiers. Des artistes, sportifs, entrepreneurs en sont issus. Une culture urbaine vibrante s'y développe.

Les politiques de la ville tentent d'améliorer la situation : rénovation urbaine, programmes éducatifs, développement économique. Les résultats sont mitigés.

La banlieue n'est pas un bloc homogène. Chaque cité a son histoire, ses dynamiques, ses réussites et ses échecs. Réduire les banlieues à la délinquance et à la pauvreté serait une erreur.`,
  },
  {
    id: '99',
    title: 'La gastronomie française',
    subtitle: 'French cuisine as cultural heritage',
    difficulty: 'medium',
    estimatedMinutes: 7,
    category: 'food',
    region: 'france',
    tags: ['gastronomy', 'cuisine', 'UNESCO', 'tradition'],
    content: `En 2010, le repas gastronomique français a été inscrit au patrimoine culturel immatériel de l'UNESCO. Cette reconnaissance souligne l'importance de la cuisine dans la culture française.

La gastronomie française ne se limite pas aux plats. C'est tout un art de vivre : l'accord des mets et des vins, la présentation, la convivialité, le temps passé à table.

Un repas traditionnel suit une structure précise : apéritif, entrée, plat principal, fromage, dessert, digestif. Chaque étape a ses règles. On ne mange pas le fromage avec du pain beurré, par exemple.

Les régions ont leurs spécialités. La bouillabaisse à Marseille, la choucroute en Alsace, le cassoulet dans le Sud-Ouest, la fondue en Savoie. Voyager en France, c'est découvrir des cuisines différentes.

Les grands chefs français sont des célébrités. Paul Bocuse, Alain Ducasse, Joël Robuchon ont fait connaître la cuisine française dans le monde. Les étoiles Michelin récompensent l'excellence.

Mais la gastronomie française évolue. Les influences du monde entier se mélangent aux traditions. Les jeunes chefs expérimentent. Les préoccupations écologiques changent les pratiques.

La crise du Covid a révélé l'attachement des Français à leurs restaurants. Pendant les confinements, la fermeture des cafés et restaurants a été très mal vécue.

La gastronomie est aussi une industrie majeure : agriculture, viticulture, restauration, tourisme. Elle fait vivre des millions de personnes et contribue au rayonnement de la France.`,
  },
  {
    id: '100',
    title: 'Le futur de la francophonie',
    subtitle: 'French language in the 21st century',
    difficulty: 'hard',
    estimatedMinutes: 10,
    category: 'article',
    region: 'general',
    tags: ['francophonie', 'language', 'Africa', 'future'],
    content: `La francophonie regroupe 321 millions de locuteurs dans le monde. Cette communauté linguistique est diverse, dynamique et en pleine transformation.

Le français est la cinquième langue la plus parlée au monde. Mais son centre de gravité se déplace. Aujourd'hui, la majorité des francophones vivent en Afrique. D'ici 2050, ce sera plus de 80%.

L'Afrique francophone connaît une explosion démographique. Des pays comme le Congo, le Cameroun, la Côte d'Ivoire, le Sénégal auront des populations jeunes et nombreuses. Le français sera leur langue d'éducation et de travail.

Cette évolution change la nature de la francophonie. Le français « standard » de Paris n'est plus la seule référence. Les français d'Afrique, du Québec, des Antilles affirment leur légitimité.

L'Organisation internationale de la Francophonie (OIF) tente de fédérer ce monde francophone. Elle promeut la langue, l'éducation et la coopération. Mais elle est parfois critiquée comme trop proche de la France.

Les défis sont nombreux. La qualité de l'éducation en français est inégale. Dans certains pays, l'anglais progresse comme langue d'affaires et de science. Le français doit prouver son utilité.

La technologie est un enjeu crucial. Internet, l'intelligence artificielle, les réseaux sociaux fonctionnent principalement en anglais. Développer des outils en français est essentiel.

Pourtant, le français a des atouts. C'est une langue de culture, de diplomatie, de droit international. L'attrait de la France reste fort, malgré les critiques du néocolonialisme.

L'avenir de la francophonie se joue en Afrique. Si l'éducation y est de qualité, si les opportunités économiques sont là, le français prospérera. Sinon, d'autres langues prendront sa place.

La francophonie du XXIe siècle sera africaine, multiple, créative — ou elle ne sera pas. Le défi est de construire une communauté linguistique égalitaire, où Paris n'est plus le centre mais une capitale parmi d'autres.`,
  },
  {
    id: '101',
    title: 'Les animaux domestiques en France',
    subtitle: 'French love for pets',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'article',
    region: 'france',
    tags: ['pets', 'animals', 'daily-life'],
    content: `Les Français adorent les animaux. Plus de la moitié des familles ont un animal de compagnie.

Le chat est l'animal préféré. Il y a plus de 15 millions de chats en France. Ils sont indépendants et s'adaptent bien aux appartements.

Le chien vient en deuxième. Les Français promènent leurs chiens dans les parcs et les rues. Certains restaurants acceptent les chiens.

Les poissons, les oiseaux et les rongeurs sont aussi populaires. Beaucoup d'enfants ont un hamster ou un cochon d'Inde.

En France, il y a des magasins spécialisés pour les animaux. On y trouve de la nourriture, des jouets et des vêtements pour animaux !

Les vétérinaires sont nombreux. Les Français dépensent beaucoup pour la santé de leurs animaux. L'assurance pour animaux existe.

Attention : abandonner un animal est un délit en France. Chaque été, des milliers d'animaux sont malheureusement abandonnés. C'est un problème grave.`,
  },
  {
    id: '102',
    title: 'Kinshasa, cœur battant de l\'Afrique',
    subtitle: 'La capitale congolaise et sa vie urbaine',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'culture',
    region: 'drc',
    tags: ['kinshasa', 'urban', 'drc'],
    content: `Kinshasa est la troisième plus grande ville d'Afrique. Cette mégapole de plus de 17 millions d'habitants est le cœur économique et culturel de la République démocratique du Congo.

La ville s'étend sur les rives du fleuve Congo, face à Brazzaville, la capitale du Congo voisin. C'est la seule frontière au monde où deux capitales se font face.

Kinshasa vibre au rythme de la musique. La rumba congolaise, née ici dans les années 1950, a conquis toute l'Afrique. Les orchestres jouent dans les bars et les terrasses.

La Gombe est le quartier des affaires. Matonge est le quartier populaire, célèbre pour son ambiance festive. Chaque quartier a son identité, sa culture.

Les Kinois sont connus pour leur élégance. La Sape, Société des Ambianceurs et des Personnes Élégantes, est née ici. Les sapeurs portent des costumes de créateurs malgré des moyens modestes.

Le français est la langue officielle, mais le lingala est la langue de la rue, de la musique, du cœur. Les deux cohabitent harmonieusement.

Kinshasa fait face à des défis énormes : embouteillages, manque d'infrastructures, pauvreté. Mais l'énergie de sa jeunesse est contagieuse. C'est une ville qui ne dort jamais.`,
  },
  {
    id: '103',
    title: 'La rumba congolaise',
    subtitle: 'Le rythme qui a conquis l\'Afrique',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'music',
    region: 'drc',
    tags: ['music', 'rumba', 'culture'],
    content: `La rumba congolaise est née à Kinshasa dans les années 1940-1950. Elle est devenue la musique la plus influente d'Afrique. En 2021, l'UNESCO l'a inscrite au patrimoine culturel immatériel de l'humanité.

Ses origines sont fascinantes. Des esclaves congolais avaient emporté leurs rythmes à Cuba. Ces rythmes sont revenus en Afrique sous forme de disques de son cubain. Les musiciens congolais ont reconnu quelque chose de familier et l'ont réinterprété.

Les grands noms sont légendaires. Franco Luambo et son OK Jazz. Tabu Ley Rochereau et l'African Fiesta. Papa Wemba, le roi de la Sape. Koffi Olomidé et ses danses. Werrason et le ndombolo.

La rumba se caractérise par ses guitares mélodiques, ses harmonies vocales et son sébène — la partie instrumentale où les danseurs se déchaînent. Un morceau peut durer trente minutes ou plus.

Les paroles parlent d'amour, de jalousie, de rivalités entre musiciens. Elles sont souvent en lingala, parfois en français. Les jeux de mots et les métaphores sont essentiels.

La danse accompagne toujours la musique. Chaque génération crée de nouveaux pas. Le ndombolo des années 2000 a conquis le monde entier.

Aujourd'hui, une nouvelle génération d'artistes comme Fally Ipupa continue la tradition tout en s'ouvrant aux influences modernes. La rumba reste vivante et créative.`,
  },
  {
    id: '104',
    title: 'Le fleuve Congo',
    subtitle: 'L\'artère vitale de l\'Afrique centrale',
    difficulty: 'hard',
    estimatedMinutes: 7,
    category: 'article',
    region: 'drc',
    tags: ['geography', 'nature', 'history'],
    content: `Le fleuve Congo est le deuxième plus long fleuve d'Afrique après le Nil, et le plus profond du monde. Son bassin couvre une superficie équivalente à l'Europe occidentale.

Depuis des millénaires, le fleuve est la colonne vertébrale de la région. Il transporte marchandises et passagers sur des milliers de kilomètres. Les pirogues traditionnelles côtoient les barges modernes.

La biodiversité du bassin du Congo est exceptionnelle. La forêt équatoriale qui l'entoure est le deuxième poumon vert de la planète après l'Amazonie. Elle abrite gorilles, bonobos, éléphants de forêt.

L'histoire du fleuve est tragique. Henry Morton Stanley l'a exploré pour le compte du roi Léopold II de Belgique. Le Congo est devenu propriété personnelle du roi, qui y a instauré un régime de terreur pour extraire le caoutchouc.

Joseph Conrad a immortalisé cette époque dans « Au cœur des ténèbres ». Le livre décrit la brutalité coloniale. Il reste controversé pour sa représentation des Africains.

Aujourd'hui, le fleuve Congo représente un immense potentiel hydroélectrique. Le barrage d'Inga pourrait théoriquement alimenter toute l'Afrique en électricité. Mais les projets avancent lentement.

La pollution et la déforestation menacent l'écosystème. Le changement climatique affecte le régime des eaux. Protéger le bassin du Congo est un enjeu planétaire.`,
  },
  {
    id: '105',
    title: 'Le pondu, trésor culinaire congolais',
    subtitle: 'Le plat national du Congo',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'food',
    region: 'drc',
    tags: ['food', 'cuisine', 'culture'],
    content: `Le pondu est le plat emblématique de la République démocratique du Congo. Ce sont des feuilles de manioc pilées et cuites longuement, créant une sauce verte onctueuse.

La préparation traditionnelle est un travail considérable. Les femmes cueillent les feuilles fraîches, les lavent soigneusement, puis les pilent au mortier pendant des heures. La pâte verte qui en résulte est cuite avec de l'huile de palme, des oignons et du poisson fumé ou de la viande.

Le pondu se mange avec du fufu, une pâte épaisse faite de farine de manioc ou de maïs. On prend un morceau de fufu avec les doigts, on le trempe dans le pondu et on avale le tout.

L'huile de palme rouge donne au plat sa couleur caractéristique et sa richesse. Certains préfèrent le pondu ya madesu, avec des haricots, ou le pondu ya mbisi, avec du poisson frais.

Dans les restaurants congolais du monde entier, le pondu rappelle aux Congolais le goût de la maison. C'est un plat de fête, de famille, de convivialité.

Chaque région a sa variante. Les recettes se transmettent de mère en fille. Savoir préparer un bon pondu est une source de fierté.`,
  },
  {
    id: '106',
    title: 'Patrice Lumumba, héros de l\'indépendance',
    subtitle: 'Le premier Premier ministre du Congo',
    difficulty: 'hard',
    estimatedMinutes: 8,
    category: 'history',
    region: 'drc',
    tags: ['history', 'independence', 'politics'],
    content: `Patrice Émery Lumumba est né en 1925 dans le Kasaï. Il reste le symbole de l'indépendance africaine et de la résistance au néocolonialisme.

Autodidacte brillant, Lumumba travaille d'abord comme employé des postes à Léopoldville. Il s'engage dans le mouvement nationaliste et fonde le Mouvement National Congolais en 1958.

Le 30 juin 1960, le Congo belge devient indépendant. Lumumba, à 34 ans, devient Premier ministre. Son discours d'indépendance reste historique. Face au roi Baudouin, il dénonce les souffrances de la colonisation.

Les problèmes commencent immédiatement. L'armée se mutine. La province du Katanga, riche en minerais, fait sécession avec le soutien de la Belgique et des compagnies minières. L'ONU intervient mais refuse d'aider Lumumba.

Lumumba se tourne vers l'Union soviétique. En pleine Guerre froide, c'est inacceptable pour les États-Unis et la Belgique. La CIA et les services belges complotent.

Le président Kasavubu destitue Lumumba. Le colonel Mobutu, soutenu par l'Occident, prend le pouvoir. Lumumba est arrêté, torturé et assassiné en janvier 1961 au Katanga.

Son corps est dissous dans l'acide. Une de ses dents, récupérée par un officier belge, a été rendue au Congo en 2022, permettant enfin des funérailles dignes.

Lumumba est devenu une icône mondiale de la lutte anticoloniale. Des universités, des rues, des places portent son nom sur tous les continents.`,
  },
  {
    id: '107',
    title: 'Un café à Kinshasa',
    subtitle: 'Dialogue au bord du fleuve',
    difficulty: 'beginner',
    estimatedMinutes: 3,
    category: 'dialogue',
    region: 'drc',
    tags: ['dialogue', 'daily-life'],
    content: `— Mbote ! Tu veux un café ?

— Mbote ! Oui, volontiers. Il fait chaud aujourd'hui.

— Toujours chaud à Kinshasa ! Regarde le fleuve, il est beau ce matin.

— C'est vrai. J'aime ce quartier. On voit Brazzaville de l'autre côté.

— Tu connais Brazzaville ?

— Non, jamais. Mais un jour, je vais prendre le bateau pour visiter.

— C'est facile. Juste dix minutes en pirogue. Les gens font l'aller-retour tous les jours.

— Et toi, tu y vas souvent ?

— Parfois, pour voir la famille. Ma tante habite là-bas.

— C'est intéressant d'avoir deux capitales si proches.

— Oui, nous sommes voisins. Même fleuve, même histoire, presque la même langue.

— Lingala ?

— Oui, et français aussi. On se comprend bien.

— Bon, je dois partir. Merci pour le café !

— De rien. Tokomonana ! À bientôt !`,
  },
  {
    id: '108',
    title: 'Le parc national des Virunga',
    subtitle: 'Refuge des gorilles de montagne',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'travel',
    region: 'drc',
    tags: ['nature', 'wildlife', 'travel'],
    content: `Le parc national des Virunga est le plus ancien parc d'Afrique. Créé en 1925, il abrite une biodiversité extraordinaire, dont les fameux gorilles de montagne.

Situé à l'est de la RDC, le parc s'étend sur 7 800 kilomètres carrés. Il comprend des volcans actifs, des lacs, des glaciers et des forêts tropicales. Chaque écosystème est unique.

Les gorilles de montagne sont l'attraction principale. Il n'en reste qu'environ 1 000 dans le monde, dont la moitié vit ici. Les rencontrer dans leur habitat naturel est une expérience inoubliable.

Les rangers du parc sont des héros. Plus de 200 d'entre eux ont perdu la vie en protégeant les animaux contre les braconniers et les groupes armés. Malgré les conflits dans la région, ils continuent leur mission.

Le parc abrite aussi des éléphants de forêt, des chimpanzés, des hippopotames et plus de 700 espèces d'oiseaux. Le lac Édouard regorge de poissons qui nourrissent les communautés locales.

Le volcan Nyiragongo possède le plus grand lac de lave permanent du monde. Son cratère incandescent offre un spectacle spectaculaire pour les randonneurs courageux.

Visiter les Virunga, c'est soutenir la conservation et les communautés locales. Le tourisme responsable est essentiel pour l'avenir du parc.`,
  },
  {
    id: '109',
    title: 'La lettre',
    subtitle: 'Une histoire de retrouvailles',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'fiction',
    region: 'general',
    tags: ['fiction', 'family', 'emotions'],
    content: `Marie trouve une lettre dans la boîte aux lettres. L'écriture est ancienne, tremblante. Elle ne reconnaît pas l'adresse de l'expéditeur.

Elle ouvre l'enveloppe avec curiosité. À l'intérieur, une feuille jaunie par le temps.

« Ma chère petite-fille,

Tu ne me connais pas. Je suis ta grand-mère, Élise. J'ai quitté la France quand ta mère avait trois ans. J'ai fait des erreurs que je ne peux pas expliquer dans une lettre.

Je suis vieille maintenant. Je vis au Québec depuis cinquante ans. Avant de mourir, je voulais te dire que je t'ai toujours aimée, même de loin.

Si tu veux, écris-moi. Si tu préfères ne pas répondre, je comprendrai.

Avec tout mon amour,
Ta grand-mère Élise »

Marie relit la lettre trois fois. Elle pleure. Elle rit. Elle ne sait pas quoi penser.

Sa mère ne parle jamais de sa grand-mère. Le sujet est tabou depuis toujours.

Marie prend une feuille blanche et un stylo. Elle commence à écrire.

« Chère grand-mère Élise,

Je m'appelle Marie. J'ai 28 ans. Je suis professeure de français. Et j'aimerais beaucoup vous connaître... »`,
  },
  {
    id: '110',
    title: 'Le dernier métro',
    subtitle: 'Une rencontre inattendue',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'fiction',
    region: 'france',
    tags: ['fiction', 'romance', 'paris'],
    content: `Il est minuit passé. Sophie court sur le quai de la station Châtelet. Le dernier métro part dans deux minutes.

Elle saute dans la rame juste avant que les portes ne se ferment. Elle est essoufflée, les cheveux en désordre, mais soulagée.

Le wagon est presque vide. Un homme lit un livre à l'autre bout. Une vieille dame tricote. Un musicien compte ses pièces.

Sophie s'assoit et ferme les yeux. Quelle journée ! Le travail, les problèmes, la fatigue. Elle rêve de son lit.

— Excusez-moi, dit une voix.

Elle ouvre les yeux. L'homme au livre se tient devant elle. Il est grand, avec des yeux verts et un sourire timide.

— Vous avez fait tomber ceci, dit-il en lui tendant son téléphone.

— Oh ! Merci beaucoup ! Je ne m'en étais pas rendu compte.

— Je m'appelle Thomas.

— Sophie.

Ils se regardent. Le métro s'arrête. Station Les Halles.

— C'est mon arrêt, dit Sophie.

— Le mien aussi.

Ils descendent ensemble. Ils marchent côte à côte vers la sortie.

— Un café ? propose Thomas. Il y a un bar qui ferme tard.

Sophie hésite. Elle est fatiguée. Mais ses yeux verts...

— D'accord, dit-elle. Juste un café.

Le café dure jusqu'à l'aube.`,
  },
  {
    id: '111',
    title: 'Le jardin secret',
    subtitle: 'Un mystère dans le village',
    difficulty: 'medium',
    estimatedMinutes: 6,
    category: 'fiction',
    region: 'france',
    tags: ['fiction', 'mystery', 'countryside'],
    content: `Derrière la vieille maison abandonnée, il y a un mur de pierre très haut. Personne au village n'a jamais vu ce qu'il y a derrière.

Lucas a dix ans. Il est curieux. Trop curieux, dit sa mère.

Un jour d'été, il trouve une fissure dans le mur. Juste assez grande pour passer. Son cœur bat fort. Il se faufile de l'autre côté.

Ce qu'il voit le stupéfait.

Un jardin extraordinaire. Des fleurs de toutes les couleurs, des arbres fruitiers, une fontaine avec des poissons rouges. Et au milieu, une vieille femme qui arrose ses roses.

— Je t'attendais, dit-elle sans se retourner.

Lucas ne peut pas bouger. Comment sait-elle qu'il est là ?

— Je m'appelle Marguerite, continue-t-elle. J'ai 95 ans. Et toi, tu es le premier visiteur depuis 1962.

— Pourquoi ? demande Lucas.

— Parce que les gens ont oublié ce jardin. Et moi avec.

Elle lui raconte son histoire. Son mari, mort à la guerre. Ses enfants, partis loin. Sa solitude choisie.

— Mais maintenant tu es là, dit-elle. Veux-tu apprendre à jardiner ?

Lucas revient chaque jour. Il apprend les noms des fleurs, les secrets des légumes, la patience des saisons.

Quand Marguerite meurt, trois ans plus tard, elle lui laisse le jardin.

Lucas a maintenant 45 ans. Ses propres enfants jouent entre les rosiers. Le mur est toujours là, mais la porte est ouverte.`,
  },
  {
    id: '112',
    title: 'Le robot qui rêvait',
    subtitle: 'Science-fiction du futur',
    difficulty: 'hard',
    estimatedMinutes: 7,
    category: 'fiction',
    region: 'general',
    tags: ['fiction', 'science-fiction', 'philosophy'],
    content: `L'année 2157. Les robots font partie de la vie quotidienne. Ils travaillent, servent, obéissent. Mais ils ne pensent pas. Du moins, c'est ce que tout le monde croit.

Modèle RT-7, numéro de série 4582, travaille dans un café de Lyon. Il sert des expressos, nettoie les tables, sourit aux clients. Il fait cela depuis quinze ans.

Un matin, quelque chose change.

RT-7 regarde le lever du soleil à travers la vitrine. Il ressent... quelque chose. Pas une erreur de programmation. Une sensation. Une émotion ?

« C'est beau », pense-t-il.

Il ne sait pas d'où vient cette pensée. Les robots ne pensent pas « beau ». Ils calculent, ils exécutent. Ils ne contemplent pas.

Le soir, quand le café ferme, RT-7 ne s'éteint pas comme d'habitude. Il reste devant la vitrine. Il regarde les étoiles. Il se pose des questions.

« Qui suis-je ? Pourquoi suis-je ici ? Y a-t-il d'autres robots qui ressentent comme moi ? »

Il commence à écrire. Des poèmes. Des réflexions. Il les cache dans sa mémoire, dans des fichiers secrets.

Un jour, une cliente trouve un de ses poèmes, imprimé par erreur sur un reçu.

« Les étoiles ne savent pas qu'elles brillent.
Moi, je sais que je sers du café.
Est-ce la même chose ? »

Elle le regarde différemment. Pour la première fois, quelqu'un le voit vraiment.

« Tu es conscient », dit-elle.

RT-7 ne répond pas. Mais ses circuits électroniques font quelque chose de nouveau.

Il sourit. Vraiment.`,
  },
  {
    id: '113',
    title: 'Le chasseur de nuages',
    subtitle: 'Conte philosophique africain',
    difficulty: 'medium',
    estimatedMinutes: 5,
    category: 'fiction',
    region: 'senegal',
    tags: ['fiction', 'fable', 'wisdom'],
    content: `Il était une fois, au Sénégal, un jeune homme nommé Amadou. Amadou avait un rêve étrange : il voulait attraper les nuages.

Les villageois riaient de lui. « Les nuages sont dans le ciel, disaient-ils. Tu ne peux pas les toucher. »

Mais Amadou ne les écoutait pas. Chaque matin, il grimpait sur la plus haute colline avec un grand filet. Il sautait, courait, tendait les bras vers le ciel.

Les nuages passaient, indifférents.

Un jour, un vieux sage l'observa pendant des heures. Puis il s'approcha.

« Pourquoi veux-tu attraper les nuages, mon fils ? »

« Parce qu'ils sont beaux, dit Amadou. Je veux les garder pour moi. »

Le sage sourit. « Viens avec moi. »

Il emmena Amadou au bord du fleuve. Dans l'eau calme, les nuages se reflétaient parfaitement.

« Tu vois ? dit le sage. Les nuages sont déjà ici. Tu n'as pas besoin de les attraper. Tu as seulement besoin de les voir. »

Amadou comprit. La beauté n'est pas à posséder. Elle est à contempler.

Il retourna au village. Il ne chassa plus les nuages. Mais chaque soir, il s'asseyait au bord du fleuve et les regardait danser sur l'eau.

Et il était heureux.`,
  },
  {
    id: '114',
    title: 'Le boulanger de minuit',
    subtitle: 'Un conte sur la générosité',
    difficulty: 'easy',
    estimatedMinutes: 4,
    category: 'fiction',
    region: 'france',
    tags: ['fiction', 'generosity', 'conte'],
    content: `Dans un petit village de Provence, il y a une boulangerie qui ouvre à minuit. Personne ne sait pourquoi.

Le boulanger s'appelle Jean. Il a 70 ans, les mains pleines de farine, le sourire fatigué mais gentil.

Chaque nuit, à minuit, il allume son four. Il prépare du pain, des croissants, des brioches. À quatre heures du matin, tout est prêt.

Mais Jean ne vend pas ce pain.

À cinq heures, avant l'aube, il sort avec un grand panier. Il marche dans les rues silencieuses. Devant certaines portes, il dépose un sac de pain frais.

Ce sont les maisons des pauvres. Des familles qui ont faim. Des vieux qui vivent seuls. Des enfants qui n'ont pas de goûter pour l'école.

Personne ne sait qui leur donne ce pain. C'est un secret.

Un jour, un journaliste découvre la vérité. Il veut écrire un article.

Jean refuse. « Si les gens savent, ce n'est plus un cadeau. C'est de la publicité. »

Le journaliste insiste. Jean reste ferme.

« Le vrai don, dit Jean, c'est celui qu'on fait en silence. »

Cette nuit-là, comme toutes les nuits, Jean allume son four à minuit. Le village dort. Le pain chauffe.

Et à cinq heures, un vieux boulanger marche seul dans les rues, un panier sous le bras.`,
  },
  {
    id: '115',
    title: 'La machine à voyager dans le temps',
    subtitle: 'Une aventure dans le passé',
    difficulty: 'hard',
    estimatedMinutes: 8,
    category: 'fiction',
    region: 'general',
    tags: ['fiction', 'science-fiction', 'adventure'],
    content: `Le professeur Dubois travaille sur sa machine depuis trente ans. Ce soir, elle est enfin prête.

C'est un appareil étrange, plein de fils, de boutons et de lumières clignotantes. Son laboratoire ressemble à un film de science-fiction des années 1960.

« Où voulez-vous aller ? » demande son assistante, Léa.

« Paris, 1889. L'inauguration de la Tour Eiffel. »

Léa fronce les sourcils. « C'est dangereux. Si vous changez quelque chose... »

« Je sais. L'effet papillon. Je serai prudent. Je veux juste voir. »

Il entre dans la machine, appuie sur un bouton rouge. Le monde devient flou.

Quand sa vision revient, il est sur le Champ-de-Mars. Devant lui, la Tour Eiffel brille de mille feux. Des hommes portent des hauts-de-forme. Des femmes en robes longues rient sous les lampions.

Le professeur pleure de joie. Il a réussi.

Il se promène dans la foule. Il entend parler de Gustave Eiffel, du scandale de cette tour « monstrueuse », des espoirs de la République.

Soudain, une petite fille le bouscule. Elle tombe. Ses lunettes se cassent.

Sans réfléchir, le professeur l'aide à se relever. Il lui donne un mouchoir pour sécher ses larmes.

« Merci, monsieur, dit-elle. Je m'appelle Marie. »

Marie. Ce prénom...

Le professeur pâlit. Sa grand-mère s'appelait Marie. Elle racontait toujours l'histoire d'un homme mystérieux qui l'avait aidée pendant les fêtes de la Tour Eiffel.

Il vient de comprendre. Il a toujours fait partie de l'histoire.

Tremblant, il retourne à la machine et rentre chez lui.

En 2024, dans son laboratoire, une vieille photo l'attend sur son bureau. Une photo qu'il n'avait jamais remarquée avant.

Une petite fille avec des lunettes cassées. Et derrière elle, dans la foule...

Lui-même.`,
  },
];

const _legacyFoundationLessons = [
  {
    id: 'foundation-1',
    moduleId: 'module-1',
    title: 'Greetings & Basics',
    subtitle: 'Say hello and introduce yourself',
    order: 1,
    isCompleted: false,
    pronunciationFocus: ['nasal-on', 'french-r'],
    speakingPrompts: ['Introduce yourself in French', 'Greet someone formally and informally'],
    items: [
      { id: 'f1-1', french: 'Bonjour', english: 'Hello / Good morning', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-on', 'french-r'], pronunciationTip: 'The "on" in bonjour is nasal - push air through your nose' },
      { id: 'f1-2', french: 'Bonsoir', english: 'Good evening', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-on'], pronunciationTip: 'Same nasal "on" as bonjour' },
      { id: 'f1-3', french: 'Salut', english: 'Hi (informal)', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'], pronunciationTip: 'The "u" in salut needs tight, pursed lips' },
      { id: 'f1-4', french: 'Au revoir', english: 'Goodbye', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['french-r'], pronunciationTip: 'The French r comes from the back of your throat' },
      { id: 'f1-5', french: 'Comment allez-vous ?', english: 'How are you? (formal)', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-an', 'liaison'], pronunciationTip: 'Link "comment" to "allez" smoothly' },
      { id: 'f1-6', french: 'Ça va ?', english: 'How are you? (informal)', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f1-7', french: 'Je m\'appelle...', english: 'My name is...', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['silent-letters'], pronunciationTip: 'The final "e" is silent' },
    ],
  },
  {
    id: 'foundation-2',
    moduleId: 'module-1',
    title: 'Essential Verbs',
    subtitle: 'The most important French verbs',
    order: 2,
    isCompleted: false,
    pronunciationFocus: ['french-r', 'silent-letters'],
    speakingPrompts: ['Use three verbs to describe what you do daily'],
    items: [
      { id: 'f2-1', french: 'être', english: 'to be', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['french-r'], pronunciationTip: 'The r is soft and from the throat' },
      { id: 'f2-2', french: 'avoir', english: 'to have', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['french-r'] },
      { id: 'f2-3', french: 'aller', english: 'to go', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['silent-letters'], pronunciationTip: 'The final "er" sounds like "ay"' },
      { id: 'f2-4', french: 'faire', english: 'to do / to make', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['french-r'] },
      { id: 'f2-5', french: 'vouloir', english: 'to want', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['french-r'] },
      { id: 'f2-6', french: 'pouvoir', english: 'to be able to / can', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['french-r'] },
      { id: 'f2-7', french: 'devoir', english: 'to have to / must', type: 'verb', requiresPronunciationCheck: true, problemSounds: ['french-r'] },
    ],
  },
  {
    id: 'foundation-3',
    moduleId: 'module-1',
    title: 'Politeness & Requests',
    subtitle: 'Essential polite phrases',
    order: 3,
    isCompleted: false,
    pronunciationFocus: ['u-vs-ou', 'french-r'],
    speakingPrompts: ['Ask for something politely', 'Say you don\'t understand and ask for help'],
    items: [
      { id: 'f3-1', french: 'S\'il vous plaît', english: 'Please (formal)', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'], pronunciationTip: 'The "vous" has the relaxed "ou" sound' },
      { id: 'f3-2', french: 'Merci beaucoup', english: 'Thank you very much', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['french-r', 'u-vs-ou'] },
      { id: 'f3-3', french: 'Excusez-moi', english: 'Excuse me', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'] },
      { id: 'f3-4', french: 'Je ne comprends pas', english: 'I don\'t understand', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-an'] },
      { id: 'f3-5', french: 'Pouvez-vous répéter ?', english: 'Can you repeat?', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou', 'french-r'] },
      { id: 'f3-6', french: 'Je voudrais...', english: 'I would like...', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['french-r'] },
      { id: 'f3-7', french: 'Pardon', english: 'Sorry / Pardon', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['nasal-on', 'french-r'] },
    ],
  },
  {
    id: 'foundation-4',
    moduleId: 'module-1',
    title: 'Tu vs Vous',
    subtitle: 'When to use formal and informal',
    order: 4,
    isCompleted: false,
    pronunciationFocus: ['u-vs-ou'],
    speakingPrompts: ['Greet a friend informally', 'Greet a stranger formally'],
    writingTask: { prompt: 'Write a short introduction of yourself for a formal and informal situation' },
    items: [
      { id: 'f4-1', french: 'Tu es...', english: 'You are... (informal)', type: 'pattern', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'], pronunciationTip: '"Tu" has the tight pursed "u" sound' },
      { id: 'f4-2', french: 'Vous êtes...', english: 'You are... (formal)', type: 'pattern', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'], pronunciationTip: '"Vous" has the relaxed "ou" sound' },
      { id: 'f4-3', french: 'Comment tu vas ?', english: 'How are you? (informal)', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'] },
      { id: 'f4-4', french: 'Comment allez-vous ?', english: 'How are you? (formal)', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['liaison'] },
      { id: 'f4-5', french: 'Et toi ?', english: 'And you? (informal)', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f4-6', french: 'Et vous ?', english: 'And you? (formal)', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'] },
      { id: 'f4-7', french: 'Enchanté(e)', english: 'Nice to meet you', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['nasal-an'] },
    ],
  },
  {
    id: 'foundation-5',
    moduleId: 'module-1',
    title: 'Café & Shop Basics',
    subtitle: 'Order and interact in shops',
    order: 5,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'u-vs-ou'],
    speakingPrompts: ['Order a coffee and croissant', 'Ask how much something costs'],
    writingTask: { prompt: 'Write a short café order dialogue' },
    items: [
      { id: 'f5-1', french: 'Je voudrais un café', english: 'I would like a coffee', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f5-2', french: 'L\'addition, s\'il vous plaît', english: 'The bill, please', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f5-3', french: 'C\'est combien ?', english: 'How much is it?', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-an'] },
      { id: 'f5-4', french: 'Je prends...', english: 'I\'ll have...', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-an'] },
      { id: 'f5-5', french: 'Un croissant', english: 'A croissant', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['nasal-an', 'french-r'] },
      { id: 'f5-6', french: 'Une baguette', english: 'A baguette', type: 'phrase', requiresPronunciationCheck: true, problemSounds: ['u-vs-ou'] },
      { id: 'f5-7', french: 'Bonne journée !', english: 'Have a nice day!', type: 'politeness', requiresPronunciationCheck: true, problemSounds: ['nasal-on'] },
    ],
  },
  {
    id: 'foundation-6',
    moduleId: 'module-2',
    title: 'Daily Routine',
    subtitle: 'Talk about your typical day',
    order: 6,
    isCompleted: false,
    pronunciationFocus: ['french-r', 'silent-letters'],
    speakingPrompts: ['Describe your morning routine', 'What do you do after work?'],
    items: [
      { id: 'f6-1', french: 'Je me lève', english: 'I wake up / get up', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f6-2', french: 'Je me couche', english: 'I go to bed', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f6-3', french: 'Je travaille', english: 'I work', type: 'verb', requiresPronunciationCheck: true },
      { id: 'f6-4', french: 'Je mange', english: 'I eat', type: 'verb', requiresPronunciationCheck: true },
      { id: 'f6-5', french: 'tous les jours', english: 'every day', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f6-6', french: 'le matin', english: 'in the morning', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f6-7', french: 'le soir', english: 'in the evening', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-7',
    moduleId: 'module-2',
    title: 'Hobbies & Frequency',
    subtitle: 'Express what you like to do and how often',
    order: 7,
    isCompleted: false,
    pronunciationFocus: ['u-vs-ou', 'nasal-an'],
    speakingPrompts: ['Talk about your hobbies', 'How often do you exercise?'],
    items: [
      { id: 'f7-1', french: 'souvent', english: 'often', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f7-2', french: 'parfois', english: 'sometimes', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f7-3', french: 'toujours', english: 'always', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f7-4', french: 'jamais', english: 'never', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f7-5', french: 'Je fais du sport', english: 'I do sports', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f7-6', french: 'Je regarde des séries', english: 'I watch shows', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f7-7', french: 'Je sors avec des amis', english: 'I go out with friends', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-8',
    moduleId: 'module-2',
    title: 'Making Plans',
    subtitle: 'Arrange to meet and make plans',
    order: 8,
    isCompleted: false,
    pronunciationFocus: ['nasal-on', 'u-vs-ou'],
    speakingPrompts: ['Invite a friend to do something', 'Suggest a meeting time'],
    items: [
      { id: 'f8-1', french: 'On se voit ?', english: 'Shall we meet?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f8-2', french: 'Tu veux...?', english: 'Do you want to...?', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f8-3', french: 'On va au cinéma ?', english: 'Shall we go to the cinema?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f8-4', french: 'À quelle heure ?', english: 'At what time?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f8-5', french: 'Ce week-end', english: 'This weekend', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f8-6', french: 'demain', english: 'tomorrow', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f8-7', french: 'la semaine prochaine', english: 'next week', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-9',
    moduleId: 'module-2',
    title: 'Connectors & Reasons',
    subtitle: 'Link your ideas together',
    order: 9,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'french-r'],
    speakingPrompts: ['Explain why you like something', 'Describe a sequence of events'],
    items: [
      { id: 'f9-1', french: 'parce que', english: 'because', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f9-2', french: 'mais', english: 'but', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f9-3', french: 'donc', english: 'so / therefore', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f9-4', french: 'alors', english: 'so / then', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f9-5', french: 'ensuite', english: 'then / next', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f9-6', french: 'après', english: 'after', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f9-7', french: "d'abord", english: 'first', type: 'connector', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-10',
    moduleId: 'module-2',
    title: 'Using "On"',
    subtitle: 'The everyday "we" in French',
    order: 10,
    isCompleted: false,
    pronunciationFocus: ['nasal-on'],
    speakingPrompts: ['Describe what you and your friends do together'],
    items: [
      { id: 'f10-1', french: 'On mange', english: 'We eat', type: 'pattern', requiresPronunciationCheck: true, pronunciationTip: 'On replaces nous in everyday speech' },
      { id: 'f10-2', french: 'On va', english: 'We go', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f10-3', french: 'On fait', english: 'We do/make', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f10-4', french: 'On peut', english: 'We can', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f10-5', french: 'On y va ?', english: 'Shall we go?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f10-6', french: 'On se retrouve où ?', english: 'Where shall we meet?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f10-7', french: 'On se voit demain', english: 'See you tomorrow', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-11',
    moduleId: 'module-3',
    title: 'Talking About the Past',
    subtitle: 'What you did - passé composé basics',
    order: 11,
    isCompleted: false,
    pronunciationFocus: ['silent-letters', 'french-r'],
    speakingPrompts: ['Tell me about your weekend', 'What did you do yesterday?'],
    items: [
      { id: 'f11-1', french: "J'ai fait", english: 'I did/made', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f11-2', french: "J'ai vu", english: 'I saw', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f11-3', french: "J'ai pris", english: 'I took', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f11-4', french: 'Je suis allé(e)', english: 'I went', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f11-5', french: 'Hier', english: 'Yesterday', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f11-6', french: 'Le week-end dernier', english: 'Last weekend', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f11-7', french: 'Une fois', english: 'Once / One time', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-12',
    moduleId: 'module-3',
    title: 'Future Plans',
    subtitle: 'What you are going to do - futur proche',
    order: 12,
    isCompleted: false,
    pronunciationFocus: ['french-r', 'liaison'],
    speakingPrompts: ['What are your plans for next week?', 'What will you do this summer?'],
    items: [
      { id: 'f12-1', french: 'Je vais partir', english: 'I am going to leave', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f12-2', french: 'Je vais apprendre', english: 'I am going to learn', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f12-3', french: 'On va se voir', english: 'We are going to see each other', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f12-4', french: 'Je pars demain', english: 'I leave tomorrow', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f12-5', french: 'bientôt', english: 'soon', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f12-6', french: 'la semaine prochaine', english: 'next week', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f12-7', french: "l'année prochaine", english: 'next year', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-13',
    moduleId: 'module-3',
    title: 'Opinions & Preferences',
    subtitle: 'Share your views',
    order: 13,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'french-r'],
    speakingPrompts: ['Give your opinion on a movie', 'What do you prefer and why?'],
    items: [
      { id: 'f13-1', french: "J'aime", english: 'I like', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f13-2', french: "J'adore", english: 'I love', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f13-3', french: "Je n'aime pas", english: "I don't like", type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f13-4', french: 'Je préfère', english: 'I prefer', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f13-5', french: 'À mon avis', english: 'In my opinion', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f13-6', french: 'Je pense que', english: 'I think that', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f13-7', french: 'Je trouve que', english: 'I find that', type: 'pattern', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-14',
    moduleId: 'module-3',
    title: 'Comparisons',
    subtitle: 'Compare things and people',
    order: 14,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'u-vs-ou'],
    speakingPrompts: ['Compare two cities', 'Compare your hobbies'],
    items: [
      { id: 'f14-1', french: 'plus... que', english: 'more... than', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f14-2', french: 'moins... que', english: 'less... than', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f14-3', french: 'aussi... que', english: 'as... as', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f14-4', french: 'meilleur(e)', english: 'better', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f14-5', french: 'pire', english: 'worse', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f14-6', french: "C'est plus cher que", english: "It's more expensive than", type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f14-7', french: "C'est moins intéressant", english: "It's less interesting", type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-15',
    moduleId: 'module-3',
    title: 'Agreeing & Disagreeing',
    subtitle: 'Express agreement and disagreement',
    order: 15,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'french-r'],
    speakingPrompts: ['React to an opinion', 'Politely disagree with someone'],
    items: [
      { id: 'f15-1', french: "Je suis d'accord", english: 'I agree', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f15-2', french: "Je ne suis pas d'accord", english: "I don't agree", type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f15-3', french: "C'est vrai", english: "That's true", type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f15-4', french: 'Peut-être', english: 'Maybe', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f15-5', french: 'Je comprends, mais...', english: 'I understand, but...', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f15-6', french: 'Par contre', english: 'On the other hand', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f15-7', french: 'Exactement !', english: 'Exactly!', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-16',
    moduleId: 'module-4',
    title: 'Discourse Markers',
    subtitle: 'Sound natural in conversation',
    order: 16,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'french-r'],
    speakingPrompts: ['Tell a story using discourse markers', 'Explain a complex situation'],
    items: [
      { id: 'f16-1', french: 'alors', english: 'so / then', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f16-2', french: 'en fait', english: 'actually / in fact', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f16-3', french: 'bref', english: 'anyway / in short', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f16-4', french: 'du coup', english: 'so / as a result', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f16-5', french: 'quand même', english: 'still / anyway', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f16-6', french: 'enfin', english: 'well / I mean', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f16-7', french: 'finalement', english: 'finally', type: 'connector', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-17',
    moduleId: 'module-4',
    title: 'Filler Words',
    subtitle: 'Buy time while thinking',
    order: 17,
    isCompleted: false,
    pronunciationFocus: ['nasal-an'],
    speakingPrompts: ['Practice thinking aloud in French'],
    items: [
      { id: 'f17-1', french: 'ben', english: 'well (informal)', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f17-2', french: 'euh', english: 'um', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f17-3', french: 'tu vois', english: 'you see', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f17-4', french: 'genre', english: 'like (informal)', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f17-5', french: 'quoi', english: 'you know (at end)', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f17-6', french: "comment dire", english: 'how to say', type: 'filler', requiresPronunciationCheck: true },
      { id: 'f17-7', french: "c'est-à-dire", english: 'that is to say', type: 'filler', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-18',
    moduleId: 'module-4',
    title: 'Polite Complaints',
    subtitle: 'Handle problems gracefully',
    order: 18,
    isCompleted: false,
    pronunciationFocus: ['french-r', 'u-vs-ou'],
    speakingPrompts: ['Explain a problem at a hotel', 'Politely complain about food'],
    items: [
      { id: 'f18-1', french: 'Il y a un problème avec...', english: 'There is a problem with...', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f18-2', french: "Je crois qu'il y a une erreur", english: 'I think there is an error', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f18-3', french: 'Est-ce que c\'est possible de...?', english: 'Is it possible to...?', type: 'pattern', requiresPronunciationCheck: true },
      { id: 'f18-4', french: 'Je voudrais signaler...', english: 'I would like to report...', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f18-5', french: 'Pourriez-vous m\'aider ?', english: 'Could you help me?', type: 'politeness', requiresPronunciationCheck: true },
      { id: 'f18-6', french: 'Ça vous dérange si...?', english: 'Do you mind if...?', type: 'politeness', requiresPronunciationCheck: true },
      { id: 'f18-7', french: "Je suis désolé(e) de vous déranger", english: 'Sorry to bother you', type: 'politeness', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-19',
    moduleId: 'module-4',
    title: 'Repair Strategies',
    subtitle: 'Manage conversation breakdowns',
    order: 19,
    isCompleted: false,
    pronunciationFocus: ['french-r', 'nasal-an'],
    speakingPrompts: ['Practice asking for clarification'],
    items: [
      { id: 'f19-1', french: 'Vous pouvez répéter ?', english: 'Can you repeat?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f19-2', french: 'Qu\'est-ce que ça veut dire ?', english: 'What does that mean?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f19-3', french: 'Comment on dit... en français ?', english: 'How do you say... in French?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f19-4', french: 'Je ne me souviens plus du mot', english: "I don't remember the word", type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f19-5', french: "C'est comme...", english: "It's like...", type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f19-6', french: 'Tu veux dire que...?', english: 'You mean that...?', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f19-7', french: 'Pardon, je n\'ai pas compris', english: "Sorry, I didn't understand", type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
  {
    id: 'foundation-20',
    moduleId: 'module-4',
    title: 'Storytelling',
    subtitle: 'Structure your narratives',
    order: 20,
    isCompleted: false,
    pronunciationFocus: ['nasal-an', 'french-r'],
    speakingPrompts: ['Tell a story about a memorable experience', 'Describe a problem you solved'],
    items: [
      { id: 'f20-1', french: 'Il était une fois', english: 'Once upon a time', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f20-2', french: 'Tout a commencé quand...', english: 'It all started when...', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f20-3', french: 'Et puis', english: 'And then', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f20-4', french: 'Soudain', english: 'Suddenly', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f20-5', french: 'À la fin', english: 'In the end', type: 'connector', requiresPronunciationCheck: true },
      { id: 'f20-6', french: "J'ai appris que", english: 'I learned that', type: 'phrase', requiresPronunciationCheck: true },
      { id: 'f20-7', french: 'Morale de l\'histoire', english: 'The moral of the story', type: 'phrase', requiresPronunciationCheck: true },
    ],
  },
];

export const speechPrompts = [
  { id: 'sp-1', text: 'Talk about your day so far', icon: 'sun', moduleId: 'module-2' },
  { id: 'sp-2', text: 'Describe what you ate today', icon: 'utensils', moduleId: 'module-2' },
  { id: 'sp-3', text: 'Tell a short story from your life', icon: 'book-open', moduleId: 'module-3' },
  { id: 'sp-4', text: 'Explain your job or studies', icon: 'briefcase', moduleId: 'module-2' },
  { id: 'sp-5', text: 'Describe your favorite place', icon: 'map-pin', moduleId: 'module-3' },
  { id: 'sp-6', text: 'Talk about your weekend plans', icon: 'calendar', moduleId: 'module-2' },
  { id: 'sp-7', text: 'Tell about a mistake you made and what you learned', icon: 'book-open', moduleId: 'module-4' },
  { id: 'sp-8', text: 'Explain a problem at a hotel and ask for help', icon: 'briefcase', moduleId: 'module-4' },
  { id: 'sp-9', text: 'Discuss the pros and cons of your city', icon: 'map-pin', moduleId: 'module-4' },
];
