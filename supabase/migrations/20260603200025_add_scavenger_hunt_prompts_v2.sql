-- Scavenger Hunt prompt bank, expansion v2.
--
-- Additive only: existing prompts are untouched. This broadens variety so the
-- adaptive selector has room to avoid accidental repeats, fills in the empty
-- grade_3 level, and grows the small pre_k level (the only one that shows Pre-K
-- picture hints). Guiding principle (unchanged from the v1 seed): keep the READING
-- decodable for the level even when the HUNT is harder; the skip/replace escape
-- hatch covers anything a given home doesn't have.
--
-- Every prompt_text below is distinct from the v1 seed.

INSERT INTO scavenger_hunt_prompts
  (prompt_text, target_description, example_objects, location, reading_level, difficulty, category)
VALUES

-- =====================================================================
-- pre_k  (very short, decodable; these are the clues that get picture hints)
-- =====================================================================
-- colors
('Find something pink.', 'any clearly pink object', ARRAY['toy','cup','shirt','marker','flower'], 'either', 'pre_k', 'easy', 'color'),
('Find something purple.', 'any clearly purple object', ARRAY['toy','cup','marker','grape','shirt'], 'either', 'pre_k', 'easy', 'color'),
('Find something brown.', 'any clearly brown object', ARRAY['teddy bear','box','shoe','wood','stick'], 'either', 'pre_k', 'easy', 'color'),
-- simple household objects
('Find a pen.', 'a pen', ARRAY['pen','ballpoint pen'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a box.', 'a box', ARRAY['box','cardboard box','shoe box'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a bag.', 'a bag', ARRAY['bag','tote bag','plastic bag','backpack'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a key.', 'a key', ARRAY['key','house key'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a mug.', 'a mug', ARRAY['mug','coffee mug'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a jar.', 'a jar', ARRAY['jar','glass jar','mason jar'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a fork.', 'a fork', ARRAY['fork'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a bowl.', 'a bowl', ARRAY['bowl','cereal bowl','mixing bowl'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a plate.', 'a plate', ARRAY['plate','dish'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a lamp.', 'a lamp', ARRAY['lamp','table lamp','desk lamp'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a chair.', 'a chair', ARRAY['chair','dining chair','kids chair'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a bed.', 'a bed', ARRAY['bed','crib','bunk bed'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a door.', 'a door', ARRAY['door','bedroom door','front door'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a shirt.', 'a shirt', ARRAY['shirt','t-shirt','top'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a brush.', 'a brush', ARRAY['hairbrush','brush','paint brush'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a bell.', 'a bell', ARRAY['bell','jingle bell','toy bell'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a drum.', 'a drum or toy drum', ARRAY['drum','toy drum'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a fan.', 'a fan', ARRAY['fan','box fan','ceiling fan'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a sink.', 'a sink', ARRAY['sink','bathroom sink','kitchen sink'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a rug.', 'a rug or mat', ARRAY['rug','mat','door mat'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a ring.', 'a ring', ARRAY['ring','toy ring'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a map.', 'a map', ARRAY['map','wall map','globe'], 'indoor', 'pre_k', 'easy', 'household'),
-- food
('Find an egg.', 'an egg (real or toy)', ARRAY['egg','toy egg'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a banana.', 'a banana', ARRAY['banana','toy banana'], 'indoor', 'pre_k', 'easy', 'household'),
('Find an apple.', 'an apple', ARRAY['apple','red apple','green apple'], 'indoor', 'pre_k', 'easy', 'household'),
-- shapes
('Find something with dots.', 'an object with dots or spots', ARRAY['ball','shirt','toy','dice'], 'either', 'pre_k', 'easy', 'shape'),
('Find a star shape.', 'a star shape', ARRAY['star toy','star sticker','star decoration'], 'either', 'pre_k', 'easy', 'shape'),
('Find a heart shape.', 'a heart shape', ARRAY['heart toy','heart sticker','heart pillow'], 'either', 'pre_k', 'easy', 'shape'),
('Find a square thing.', 'a square or box-shaped object', ARRAY['block','box','book','tile'], 'either', 'pre_k', 'easy', 'shape'),
-- animals (toys)
('Find a cat.', 'a cat or toy cat', ARRAY['cat','toy cat','stuffed cat'], 'either', 'pre_k', 'easy', 'animal'),
('Find a dog.', 'a dog or toy dog', ARRAY['dog','toy dog','stuffed dog'], 'either', 'pre_k', 'easy', 'animal'),
('Find a fish.', 'a fish or toy fish', ARRAY['fish','toy fish','pet fish'], 'either', 'pre_k', 'easy', 'animal'),
('Find a duck.', 'a duck or toy duck', ARRAY['duck','rubber duck','toy duck'], 'either', 'pre_k', 'easy', 'animal'),
-- outdoor nature
('Find the sun.', 'the sun in the sky', ARRAY['sun','sunshine'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find a cloud.', 'a cloud in the sky', ARRAY['cloud','clouds'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find sand.', 'sand', ARRAY['sand','sandbox','beach sand'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find dirt.', 'dirt or soil', ARRAY['dirt','soil','mud'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find a bush.', 'a bush or shrub', ARRAY['bush','shrub','hedge'], 'outdoor', 'pre_k', 'easy', 'nature'),

-- =====================================================================
-- kindergarten
-- =====================================================================
('Find a fork and a spoon.', 'a fork and a spoon together', ARRAY['fork','spoon','silverware'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a red toy.', 'a toy that is red', ARRAY['red toy','red car','red block'], 'indoor', 'kindergarten', 'easy', 'color'),
('Find a blue book.', 'a book with a blue cover', ARRAY['blue book','book'], 'indoor', 'kindergarten', 'easy', 'color'),
('Find a big cup.', 'a large cup or mug', ARRAY['big cup','mug','tumbler'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a little ball.', 'a small ball', ARRAY['small ball','bouncy ball','marble'], 'indoor', 'kindergarten', 'easy', 'shape'),
('Find a fuzzy thing.', 'a fuzzy or furry object', ARRAY['stuffed animal','blanket','sock','slipper'], 'indoor', 'kindergarten', 'easy', 'texture'),
('Find a wet thing.', 'something wet', ARRAY['towel','sponge','water','washcloth'], 'indoor', 'kindergarten', 'medium', 'texture'),
('Find a cold thing.', 'something cold to the touch', ARRAY['ice','water bottle','metal spoon','fridge'], 'indoor', 'kindergarten', 'medium', 'texture'),
('Find a lid.', 'a lid or cap', ARRAY['lid','bottle cap','jar lid','pot lid'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a pot.', 'a cooking pot or pan', ARRAY['pot','pan','saucepan'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a sponge.', 'a sponge', ARRAY['sponge','kitchen sponge','dish sponge'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a chair you sit on.', 'a chair', ARRAY['chair','dining chair','rocking chair'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a soft blanket.', 'a blanket', ARRAY['blanket','throw blanket','baby blanket'], 'indoor', 'kindergarten', 'easy', 'texture'),
('Find a yellow flower.', 'a yellow flower', ARRAY['yellow flower','dandelion','sunflower'], 'outdoor', 'kindergarten', 'easy', 'nature'),
('Find a tall tree.', 'a tall tree', ARRAY['tree','tall tree','oak tree'], 'outdoor', 'kindergarten', 'easy', 'nature'),
('Find a small rock.', 'a small rock or pebble', ARRAY['pebble','small rock','stone'], 'outdoor', 'kindergarten', 'easy', 'nature'),
('Find a fence.', 'a fence', ARRAY['fence','wooden fence','gate'], 'outdoor', 'kindergarten', 'easy', 'household'),
('Find a car outside.', 'a car or truck outdoors', ARRAY['car','truck','van'], 'outdoor', 'kindergarten', 'easy', 'household'),
('Find a ball outside.', 'a ball used outdoors', ARRAY['soccer ball','basketball','playground ball'], 'outdoor', 'kindergarten', 'easy', 'shape'),
('Find a bike.', 'a bike, trike, or scooter', ARRAY['bike','bicycle','tricycle','scooter'], 'outdoor', 'kindergarten', 'easy', 'household'),
('Find a green leaf and a rock.', 'a green leaf and a rock together', ARRAY['leaf','rock','stone'], 'outdoor', 'kindergarten', 'medium', 'nature'),

-- =====================================================================
-- grade_1
-- =====================================================================
('Find something that makes light.', 'an object that gives off light', ARRAY['lamp','flashlight','candle','phone'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something you wear on your head.', 'a hat, cap, or headband', ARRAY['hat','cap','headband','helmet'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something that keeps you warm.', 'warm clothing or a blanket', ARRAY['jacket','sweater','blanket','coat'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something that opens and shuts.', 'an object that opens and closes', ARRAY['door','box','book','drawer'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something that bounces.', 'an object that bounces', ARRAY['ball','bouncy ball','basketball'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something with a handle.', 'an object with a handle', ARRAY['cup','mug','bag','pan','door'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something soft and white.', 'a soft, white object', ARRAY['pillow','towel','tissue','sock'], 'indoor', 'grade_1', 'medium', 'texture'),
('Find a toy smaller than your hand.', 'a small toy', ARRAY['small toy','figure','toy car','block'], 'indoor', 'grade_1', 'medium', 'household'),
('Find a picture on the wall.', 'a picture, photo, or poster on a wall', ARRAY['picture','photo','poster','painting'], 'indoor', 'grade_1', 'easy', 'household'),
('Find a brush you clean with.', 'a cleaning brush or broom', ARRAY['broom','scrub brush','toilet brush'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something that tells time.', 'a clock or watch', ARRAY['clock','watch','alarm clock'], 'indoor', 'grade_1', 'medium', 'household'),
('Find a window.', 'a window', ARRAY['window'], 'indoor', 'grade_1', 'easy', 'household'),
('Find something striped.', 'an object with stripes', ARRAY['shirt','sock','towel','toy'], 'indoor', 'grade_1', 'medium', 'shape'),
('Find a feather.', 'a feather', ARRAY['feather'], 'outdoor', 'grade_1', 'medium', 'nature'),
('Find a pinecone.', 'a pinecone', ARRAY['pinecone','pine cone'], 'outdoor', 'grade_1', 'medium', 'nature'),
('Find an ant.', 'an ant', ARRAY['ant','ants'], 'outdoor', 'grade_1', 'medium', 'animal'),
('Find a worm.', 'a worm', ARRAY['worm','earthworm'], 'outdoor', 'grade_1', 'medium', 'animal'),
('Find a puddle.', 'a puddle of water', ARRAY['puddle','water puddle'], 'outdoor', 'grade_1', 'medium', 'nature'),

-- =====================================================================
-- grade_2
-- =====================================================================
('Find something that can roll.', 'an object that rolls', ARRAY['ball','can','toy car','bottle'], 'either', 'grade_2', 'medium', 'shape'),
('Find something heavier than a book.', 'an object heavier than a book', ARRAY['rock','backpack','pot','shoe'], 'either', 'grade_2', 'medium', 'household'),
('Find something lighter than a feather.', 'a very light object', ARRAY['paper','tissue','cotton ball','leaf'], 'either', 'grade_2', 'hard', 'household'),
('Find something that comes in a pair.', 'an object that comes in twos', ARRAY['shoes','socks','gloves','mittens'], 'indoor', 'grade_2', 'medium', 'household'),
('Find something that makes music.', 'a musical instrument or music toy', ARRAY['toy piano','drum','shaker','xylophone'], 'indoor', 'grade_2', 'medium', 'household'),
('Find something you use to write.', 'a writing tool', ARRAY['pencil','pen','crayon','marker'], 'indoor', 'grade_2', 'medium', 'household'),
('Find something that has a screen.', 'a device with a screen', ARRAY['tablet','phone','tv','laptop'], 'indoor', 'grade_2', 'medium', 'household'),
('Find something that floats.', 'an object that floats in water', ARRAY['toy boat','rubber duck','cork','ball'], 'indoor', 'grade_2', 'hard', 'household'),
('Find something that begins with the letter M.', 'an object whose name starts with M', ARRAY['mug','marker','mat','mirror'], 'indoor', 'grade_2', 'medium', 'letter'),
('Find something that begins with the letter P.', 'an object whose name starts with P', ARRAY['pen','pillow','plate','plant'], 'indoor', 'grade_2', 'medium', 'letter'),
('Find something that begins with the letter R.', 'an object whose name starts with R', ARRAY['rug','ring','rock','ribbon'], 'either', 'grade_2', 'medium', 'letter'),
('Find a number on something.', 'a printed or displayed number', ARRAY['clock','calendar','book page','remote'], 'indoor', 'grade_2', 'medium', 'letter'),
('Find something that is two colors.', 'an object with two clear colors', ARRAY['striped shirt','toy','box','book'], 'either', 'grade_2', 'medium', 'color'),
('Find something colder than the room.', 'a chilled or refrigerated item', ARRAY['ice','milk','frozen food','cold drink'], 'indoor', 'grade_2', 'medium', 'texture'),
('Find a leaf with pointy edges.', 'a leaf with jagged or pointed edges', ARRAY['maple leaf','oak leaf','holly leaf'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find something an animal might eat.', 'food an animal eats', ARRAY['acorn','berry','seed','grass','nut'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find something taller than you.', 'an object taller than the child', ARRAY['tree','fence','door','shelf'], 'either', 'grade_2', 'medium', 'household'),
('Find a shadow.', 'a shadow cast by an object', ARRAY['shadow','tree shadow','your shadow'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find something that grows in the ground.', 'a plant rooted in the ground', ARRAY['flower','grass','tree','weed','vegetable'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find two leaves that look different.', 'two different-looking leaves', ARRAY['leaves','leaf'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find something with a wheel and a handle.', 'an object that has both a wheel and a handle', ARRAY['scooter','wagon','wheelbarrow','stroller'], 'outdoor', 'grade_2', 'hard', 'household'),

-- =====================================================================
-- grade_3  (level was empty; clues read at a 3rd-grade level)
-- =====================================================================
('Find an object that reflects your face.', 'a reflective surface', ARRAY['mirror','window','metal spoon','phone screen'], 'indoor', 'grade_3', 'medium', 'household'),
('Find something that uses electricity.', 'an electric device', ARRAY['lamp','tv','toaster','charger','fan'], 'indoor', 'grade_3', 'medium', 'household'),
('Find an object that is transparent.', 'something you can see through', ARRAY['glass','window','clear cup','plastic wrap'], 'indoor', 'grade_3', 'hard', 'household'),
('Find something with a pattern on it.', 'an object with a repeating pattern', ARRAY['rug','blanket','shirt','wallpaper','tile'], 'indoor', 'grade_3', 'medium', 'shape'),
('Find something that protects you from rain.', 'rain protection', ARRAY['umbrella','raincoat','hood','boots'], 'either', 'grade_3', 'medium', 'household'),
('Find an object older than you are.', 'something older than the child', ARRAY['furniture','photo','book','heirloom','tree'], 'either', 'grade_3', 'hard', 'household'),
('Find something that can be folded.', 'a foldable object', ARRAY['towel','paper','blanket','chair','map'], 'indoor', 'grade_3', 'medium', 'household'),
('Find an object that holds many small things.', 'a container of small items', ARRAY['drawer','jar','box','basket','bag'], 'indoor', 'grade_3', 'medium', 'household'),
('Find something that measures something.', 'a measuring tool', ARRAY['ruler','measuring cup','scale','thermometer','tape measure'], 'indoor', 'grade_3', 'hard', 'household'),
('Find an object that makes a sound when you touch it.', 'something that sounds when touched', ARRAY['bell','keyboard','toy','rattle','piano'], 'indoor', 'grade_3', 'medium', 'household'),
('Find something that is soft on one side and hard on the other.', 'an object with a soft and a hard side', ARRAY['slipper','phone case','book','sponge'], 'indoor', 'grade_3', 'hard', 'texture'),
('Find an object you would take on a trip.', 'travel item', ARRAY['suitcase','backpack','water bottle','map','hat'], 'indoor', 'grade_3', 'medium', 'household'),
('Find something that keeps food fresh.', 'food storage', ARRAY['fridge','container','lid','plastic wrap','jar'], 'indoor', 'grade_3', 'medium', 'household'),
('Find an object shaped like a cylinder.', 'a cylinder-shaped object', ARRAY['can','cup','bottle','roll','jar'], 'indoor', 'grade_3', 'hard', 'shape'),
('Find something that has at least four legs.', 'an object with four or more legs', ARRAY['table','chair','dog','stool','bench'], 'either', 'grade_3', 'medium', 'shape'),
('Find an object that comes in different sizes.', 'something that exists in multiple sizes', ARRAY['cup','box','ball','book','shoe'], 'indoor', 'grade_3', 'medium', 'household'),
('Find something that helps you stay clean.', 'a cleaning or hygiene item', ARRAY['soap','towel','toothbrush','sponge','wipes'], 'indoor', 'grade_3', 'medium', 'household'),
('Find an object that can store a picture.', 'something that holds an image', ARRAY['phone','tablet','photo frame','camera','book'], 'indoor', 'grade_3', 'hard', 'household'),
('Find something that bends but does not break.', 'a flexible object', ARRAY['rubber band','straw','hose','paper','spaghetti'], 'either', 'grade_3', 'hard', 'texture'),
('Find an object with a point that is sharp but safe to hold.', 'a safely held pointed object', ARRAY['pencil','crayon','spoon handle','toy'], 'indoor', 'grade_3', 'hard', 'shape'),
('Find something that begins with the letter G.', 'an object whose name starts with G', ARRAY['glass','game','glove','grass'], 'either', 'grade_3', 'medium', 'letter'),
('Find something that begins with the letter W.', 'an object whose name starts with W', ARRAY['window','wall','watch','wagon'], 'either', 'grade_3', 'medium', 'letter'),
('Find a word that has more than five letters.', 'printed text with a long word', ARRAY['book','box label','poster','cereal box'], 'indoor', 'grade_3', 'hard', 'letter'),
('Find something that grows on a tree.', 'something a tree produces', ARRAY['leaf','fruit','acorn','flower','seed pod'], 'outdoor', 'grade_3', 'medium', 'nature'),
('Find an insect with more than four legs.', 'an insect or bug', ARRAY['ant','spider','beetle','centipede','bug'], 'outdoor', 'grade_3', 'hard', 'animal'),
('Find something in nature that is not green.', 'a non-green natural object', ARRAY['flower','rock','dirt','bark','feather'], 'outdoor', 'grade_3', 'medium', 'nature'),
('Find an object that moves when the wind blows.', 'something the wind moves', ARRAY['leaves','flag','wind chime','branch','grass'], 'outdoor', 'grade_3', 'hard', 'nature'),
('Find something an animal might live in.', 'an animal home', ARRAY['nest','hole','birdhouse','bush','log'], 'outdoor', 'grade_3', 'hard', 'animal'),
('Find a plant that is taller than a flower.', 'a plant taller than a flower', ARRAY['bush','tree','cornstalk','shrub'], 'outdoor', 'grade_3', 'medium', 'nature'),
('Find something smooth that you found outside.', 'a smooth outdoor object', ARRAY['rock','leaf','shell','metal railing'], 'outdoor', 'grade_3', 'medium', 'texture'),
('Find something rough that you found outside.', 'a rough outdoor object', ARRAY['bark','rock','brick','concrete','pinecone'], 'outdoor', 'grade_3', 'medium', 'texture'),
('Find an object that is the same shape as the sun.', 'a round object like the sun', ARRAY['ball','plate','clock','wheel','coin'], 'either', 'grade_3', 'medium', 'shape'),
('Find something that can carry water without spilling.', 'a watertight container', ARRAY['bottle','cup','bucket','watering can','jug'], 'either', 'grade_3', 'medium', 'household'),
('Find an object that has buttons and a screen.', 'a device with buttons and a screen', ARRAY['phone','remote','game console','calculator'], 'indoor', 'grade_3', 'hard', 'household'),
('Find something you would use on a rainy day.', 'a rainy-day item', ARRAY['umbrella','boots','raincoat','board game','book'], 'either', 'grade_3', 'medium', 'household'),
('Find an object that is both long and thin.', 'a long, thin object', ARRAY['pencil','straw','ruler','stick','spoon'], 'either', 'grade_3', 'medium', 'shape'),
('Find something that has a different color inside than outside.', 'an object differently colored inside', ARRAY['fruit','box','shoe','bag','book'], 'either', 'grade_3', 'hard', 'color'),
('Find an object that you can see your reflection in outside.', 'a reflective outdoor surface', ARRAY['window','car','puddle','metal','mirror'], 'outdoor', 'grade_3', 'hard', 'nature'),
('Find something that would melt in the sun.', 'something that melts', ARRAY['ice','popsicle','chocolate','crayon','snow'], 'either', 'grade_3', 'hard', 'texture'),
('Find an object that helps plants grow.', 'something that helps plants', ARRAY['watering can','hose','soil','sun','shovel'], 'outdoor', 'grade_3', 'medium', 'nature'),
('Find something that has a top and a bottom.', 'an object with a distinct top and bottom', ARRAY['cup','jar','box','bottle','lamp'], 'indoor', 'grade_3', 'medium', 'shape'),
('Find an object that you push to make it go.', 'something propelled by pushing', ARRAY['scooter','wagon','stroller','toy car','swing'], 'outdoor', 'grade_3', 'medium', 'household'),
('Find something that is warmer in the sun than in the shade.', 'an object warmed by sunlight', ARRAY['rock','metal','pavement','car','bench'], 'outdoor', 'grade_3', 'hard', 'nature'),
('Find an object that makes a shadow taller than itself.', 'something casting a long shadow', ARRAY['stick','pole','fence','tree','person'], 'outdoor', 'grade_3', 'hard', 'nature');
