-- Seed the scavenger hunt prompt bank.
-- Keep the READING easy (short, decodable, common sight words) even when the HUNT
-- is harder. The bank assumes a typical home/yard and a varied playroom; the
-- skip/replace escape hatch covers anything a given home doesn't have.

INSERT INTO scavenger_hunt_prompts
  (prompt_text, target_description, example_objects, location, reading_level, difficulty, category)
VALUES
-- ===== Indoor — general (easy) =====
('Find something red.', 'any clearly red object', ARRAY['apple','toy','cup','book','sock'], 'indoor', 'pre_k', 'easy', 'color'),
('Find something blue.', 'any clearly blue object', ARRAY['cup','toy','shirt','book','marker'], 'indoor', 'pre_k', 'easy', 'color'),
('Find something green.', 'any clearly green object', ARRAY['plant','toy','cup','marker','book'], 'indoor', 'pre_k', 'easy', 'color'),
('Find something yellow.', 'any clearly yellow object', ARRAY['banana','toy','cup','crayon','duck'], 'indoor', 'pre_k', 'easy', 'color'),
('Find a soft thing.', 'a soft, squishy object you could hug or squeeze', ARRAY['pillow','blanket','stuffed animal','towel'], 'indoor', 'pre_k', 'easy', 'texture'),
('Find a cup.', 'a cup, mug, or drinking glass', ARRAY['cup','mug','glass','sippy cup'], 'indoor', 'pre_k', 'easy', 'household'),
('Find a book.', 'a book or magazine', ARRAY['book','storybook','magazine'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a spoon.', 'a spoon', ARRAY['spoon','teaspoon'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a hat.', 'a hat or cap', ARRAY['hat','cap','beanie'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a shoe.', 'a shoe, sneaker, or sandal', ARRAY['shoe','sneaker','boot','sandal'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a sock.', 'a sock', ARRAY['sock'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a clock.', 'a clock (wall, desk, or on an appliance)', ARRAY['clock','wall clock','alarm clock'], 'indoor', 'grade_1', 'easy', 'household'),
('Find something you read.', 'something with words to read', ARRAY['book','magazine','sign','box','label'], 'indoor', 'grade_1', 'easy', 'household'),
('Find a thing with a zipper.', 'an object that has a zipper', ARRAY['jacket','backpack','bag','pencil case'], 'indoor', 'grade_1', 'medium', 'household'),
('Find something with buttons.', 'an object with buttons (clothing or device)', ARRAY['remote','shirt','jacket','toy'], 'indoor', 'grade_1', 'medium', 'household'),
('Find a plant.', 'a houseplant or potted plant', ARRAY['plant','flower pot','succulent'], 'indoor', 'grade_1', 'easy', 'nature'),
('Find a pillow.', 'a pillow or cushion', ARRAY['pillow','cushion','throw pillow'], 'indoor', 'grade_1', 'easy', 'household'),
('Find a toothbrush.', 'a toothbrush', ARRAY['toothbrush'], 'indoor', 'grade_1', 'easy', 'household'),
('Find a towel.', 'a towel', ARRAY['towel','bath towel','hand towel'], 'indoor', 'grade_1', 'easy', 'household'),
('Find something cold from the kitchen.', 'a cold or refrigerated item', ARRAY['ice','milk','juice','fruit','water bottle'], 'indoor', 'grade_2', 'medium', 'household'),
('Find something that can hold water.', 'a container that holds water', ARRAY['cup','bottle','bowl','bucket','vase'], 'indoor', 'grade_2', 'medium', 'household'),

-- ===== Indoor — playroom toys (easy-medium) =====
('Find a toy car.', 'a toy car or truck', ARRAY['toy car','toy truck','race car'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a ball.', 'any ball', ARRAY['ball','bouncy ball','soccer ball','beach ball'], 'indoor', 'kindergarten', 'easy', 'shape'),
('Find a doll.', 'a doll or action figure', ARRAY['doll','baby doll','action figure','figure'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a block.', 'a building block or Lego', ARRAY['block','lego','building block','wooden block'], 'indoor', 'kindergarten', 'easy', 'household'),
('Find a dinosaur.', 'a dinosaur toy or figurine', ARRAY['dinosaur toy','t-rex figure','dino'], 'indoor', 'grade_1', 'easy', 'animal'),
('Find a teddy bear.', 'a teddy bear or plush bear', ARRAY['teddy bear','plush bear','stuffed bear'], 'indoor', 'grade_1', 'easy', 'animal'),
('Find a stuffed animal.', 'any plush / stuffed animal toy', ARRAY['stuffed animal','plush toy','teddy bear'], 'indoor', 'grade_1', 'easy', 'animal'),
('Find a puzzle.', 'a puzzle or puzzle pieces', ARRAY['puzzle','jigsaw puzzle','puzzle piece'], 'indoor', 'grade_1', 'easy', 'household'),
('Find a crayon.', 'a crayon, marker, or colored pencil', ARRAY['crayon','marker','colored pencil'], 'indoor', 'grade_1', 'easy', 'household'),
('Find a princess.', 'a princess doll, figurine, or character toy', ARRAY['princess doll','disney princess','princess figure'], 'indoor', 'grade_1', 'medium', 'household'),
('Find a toy that has wheels.', 'a toy with wheels', ARRAY['toy car','toy truck','train','scooter toy'], 'indoor', 'grade_1', 'medium', 'household'),
('Find the play kitchen.', 'a toy kitchen play set', ARRAY['play kitchen','toy kitchen','kitchen play set'], 'indoor', 'grade_2', 'medium', 'household'),
('Find the doll house.', 'a dollhouse', ARRAY['dollhouse','doll house'], 'indoor', 'grade_2', 'medium', 'household'),
('Find a toy that makes a sound.', 'a toy that can make noise', ARRAY['musical toy','rattle','toy instrument','electronic toy'], 'indoor', 'grade_2', 'medium', 'household'),
('Find your favorite toy.', 'any toy the child likes', ARRAY['toy','stuffed animal','doll','figure'], 'indoor', 'grade_1', 'easy', 'household'),

-- ===== Outdoor — yard & nature (easy-medium) =====
('Find a green leaf.', 'a green leaf', ARRAY['leaf','green leaf'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find a rock.', 'a rock or stone', ARRAY['rock','stone','pebble'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find a stick.', 'a stick or twig', ARRAY['stick','twig','branch'], 'outdoor', 'pre_k', 'easy', 'nature'),
('Find a flower.', 'a flower', ARRAY['flower','bloom','daisy','rose'], 'outdoor', 'kindergarten', 'easy', 'nature'),
('Find a tree.', 'a tree', ARRAY['tree','tree trunk'], 'outdoor', 'kindergarten', 'easy', 'nature'),
('Find grass.', 'grass', ARRAY['grass','lawn'], 'outdoor', 'kindergarten', 'easy', 'nature'),
('Find a bug.', 'an insect or bug', ARRAY['bug','ant','ladybug','beetle','insect'], 'outdoor', 'grade_1', 'medium', 'animal'),
('Find a bird.', 'a bird (or a clear sign of one, like a feather or nest)', ARRAY['bird','feather','nest'], 'outdoor', 'grade_1', 'medium', 'animal'),
('Find the swings.', 'a swing or swing set', ARRAY['swing','swing set'], 'outdoor', 'grade_1', 'easy', 'household'),
('Find the slide.', 'a playground slide', ARRAY['slide','playground slide'], 'outdoor', 'grade_1', 'easy', 'household'),
('Find the trampoline.', 'a trampoline', ARRAY['trampoline'], 'outdoor', 'grade_1', 'easy', 'household'),
('Find the bird feeder.', 'a bird feeder', ARRAY['bird feeder','feeder'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find the play house.', 'an outdoor playhouse', ARRAY['playhouse','play house'], 'outdoor', 'grade_2', 'medium', 'household'),
('Find water.', 'water: a pool, pond, fountain, or water feature', ARRAY['pool','pond','fountain','hose water','puddle'], 'outdoor', 'grade_1', 'easy', 'nature'),
('Find a flower that is not green.', 'a flower of any color other than green', ARRAY['red flower','yellow flower','purple flower'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find something in the garden.', 'a plant or vegetable growing in a garden bed', ARRAY['tomato plant','vegetable','herb','garden plant'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find a stick longer than your arm.', 'a long stick or branch', ARRAY['long stick','branch','big stick'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find a pet.', 'a family pet such as a dog or cat', ARRAY['dog','cat','pet'], 'outdoor', 'grade_1', 'easy', 'animal'),
('Find something that is alive.', 'a living thing: a plant, bug, bird, or pet', ARRAY['plant','bug','bird','pet','flower'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find a brown thing outside.', 'any clearly brown object or natural item outside', ARRAY['dirt','bark','rock','stick','mulch'], 'outdoor', 'grade_1', 'easy', 'color'),
('Find something that grows.', 'a growing plant, flower, tree, or vegetable', ARRAY['plant','flower','tree','vegetable'], 'outdoor', 'grade_2', 'medium', 'nature'),

-- ===== Either indoor or outdoor =====
('Find something round.', 'a round / circular object', ARRAY['ball','plate','clock','wheel','orange'], 'either', 'kindergarten', 'easy', 'shape'),
('Find something with a line.', 'an object with a clear straight line or stripe', ARRAY['ruler','striped shirt','book edge','crosswalk'], 'either', 'grade_1', 'medium', 'shape'),
('Find something white.', 'any clearly white object', ARRAY['paper','cloud','cup','sock','flower'], 'either', 'pre_k', 'easy', 'color'),
('Find something black.', 'any clearly black object', ARRAY['shoe','remote','tire','marker'], 'either', 'pre_k', 'easy', 'color'),
('Find something orange.', 'any clearly orange object', ARRAY['orange','toy','flower','cone','carrot'], 'either', 'kindergarten', 'easy', 'color'),
('Find something big.', 'a large object', ARRAY['tree','couch','car','door','box'], 'either', 'kindergarten', 'easy', 'shape'),
('Find something small.', 'a small object', ARRAY['coin','button','pebble','bead','crayon'], 'either', 'kindergarten', 'easy', 'shape'),
('Find something hard.', 'a hard object', ARRAY['rock','table','toy car','book'], 'either', 'grade_1', 'easy', 'texture'),
('Find something smooth.', 'a smooth object', ARRAY['ball','stone','glass','plate'], 'either', 'grade_1', 'medium', 'texture'),
('Find something that is shiny.', 'a shiny / reflective object', ARRAY['spoon','mirror','foil','metal toy'], 'either', 'grade_2', 'medium', 'texture'),
('Find two things that are the same.', 'two matching objects shown together', ARRAY['two socks','pair of shoes','matching toys','two blocks'], 'either', 'grade_2', 'medium', 'shape'),

-- ===== Reading-skill prompts (ties hunt to phonics) =====
('Find something that starts with B.', 'an object whose name starts with the /b/ sound', ARRAY['ball','book','boot','banana','box'], 'either', 'grade_1', 'medium', 'letter'),
('Find something that starts with S.', 'an object whose name starts with the /s/ sound', ARRAY['sock','spoon','stick','shoe','seed'], 'either', 'grade_1', 'medium', 'letter'),
('Find something that starts with T.', 'an object whose name starts with the /t/ sound', ARRAY['toy','tree','towel','table','truck'], 'either', 'grade_1', 'medium', 'letter'),
('Find something that starts with C.', 'an object whose name starts with the /k/ sound', ARRAY['cup','car','cat','cookie','crayon'], 'either', 'grade_1', 'medium', 'letter'),
('Find something that starts with F.', 'an object whose name starts with the /f/ sound', ARRAY['flower','fork','fish','feather','foot'], 'either', 'grade_2', 'medium', 'letter'),
('Find something that starts with the same sound as your name.', 'an object whose name starts with the same sound as the child''s name', ARRAY['matching first-letter object'], 'either', 'grade_2', 'hard', 'letter'),
('Find something with the letter A on it.', 'an object with a visible letter A', ARRAY['book','box','sign','label','toy'], 'either', 'grade_2', 'medium', 'letter'),

-- ===== Slightly harder open-ended (easy reading, harder hunt) =====
('Find something soft you can hug.', 'a soft object the child could hug', ARRAY['pillow','blanket','stuffed animal','teddy bear'], 'indoor', 'grade_2', 'easy', 'texture'),
('Find a leaf bigger than your hand.', 'a large leaf', ARRAY['big leaf','large leaf'], 'outdoor', 'grade_2', 'medium', 'nature'),
('Find something that helps you sleep.', 'an object associated with sleep', ARRAY['pillow','blanket','stuffed animal','bed','night light'], 'indoor', 'grade_2', 'medium', 'household'),
('Find something you wear on your feet.', 'footwear', ARRAY['shoe','sock','sandal','boot','slipper'], 'either', 'grade_1', 'easy', 'household'),
('Find something you eat.', 'a food item', ARRAY['fruit','snack','bread','vegetable','cereal'], 'indoor', 'grade_1', 'easy', 'household'),
('Find something that is your favorite color.', 'an object in the child''s favorite color', ARRAY['toy','cup','shirt','book'], 'either', 'grade_2', 'easy', 'color'),
('Find something that can fly.', 'something that can fly or a toy/picture of it', ARRAY['bird','butterfly','toy plane','kite','bug'], 'either', 'grade_2', 'medium', 'animal'),
('Find something with wings.', 'an object or creature with wings', ARRAY['bird','butterfly','toy plane','bug','angel toy'], 'either', 'grade_2', 'medium', 'animal'),
('Find a happy face.', 'a smiling face on a toy, drawing, book, or person', ARRAY['stuffed animal face','drawing','book character','emoji'], 'either', 'grade_2', 'medium', 'shape');
