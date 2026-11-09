

# Overview
static web-app
use typescript
target hosting is github.io pages
must be mobile-friendly, very easy to use with touch-based inputs

# data source
read MegaMek export format files from the "mechs" folder

should be able to read in the equipment for a mech

# MVP

user should be able to pick a mech (from teh mechs folder) by a dropdown

main UI should list all weapons for the mech

user should be able to select which weapons to fire (default to all weapons selected)

user should be able to enter all GATOR values
- Gunnery skill should be a value from 5 (worst) to -1 (best), starting at 4
- Attacker movement should selected from these options, should apply the modifier in the parenthesis, and should default to "Run":
  - Stationary (+0)
  - Walk (+1)
  - Run (+2)
  - Jump (+3)
  - Prone (+4)
- Target movement should be a value from 0 to 6, default to 2
- Other should be a numeric entry field, default to 0
- Range should be selected from these options, should apply the modifier in parenthesis, and should default to "Short":
  - Short (+0)
  - Medium (+2)
  - Long (+4)

The sum total of GATOR determines the Target Number (TN)

user should be able to select the hit location on the target from the following options, default to "Front":
- Front
- Left
- Right
- Rear

user can then click "Fire" button to continue

for each selected weapon:

  should use strong cryptographic randomness to roll 2D6
  if the rolled number is equal to or greater than the TN, the weapon hits.
  calculate damage applied including using the cluster hit table for cluster weapons
  calcuate the hit location for each hit or cluster hit
  report the result to the user by indicating the weapon name, the TN, the rolled to-hit, the damage(s), and the location(s)




---

# Cluster Hit Table
| Die Roll (2D6) | Number of Missiles/Pellets Fired |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
|   | 2 | 3 | 4 | 5 | 6 | 9 | 10 | 12 | 15 | 20 |
| 2 | 1 | 1 | 1 | 1 | 2 | 3 | 3 | 4 | 5 | 6 |
| 3 | 1 | 1 | 2 | 2 | 2 | 3 | 3 | 4 | 5 | 6 |
| 4 | 1 | 1 | 2 | 2 | 3 | 4 | 4 | 5 | 6 | 9 |
| 5 | 1 | 2 | 2 | 3 | 3 | 5 | 6 | 8 | 9 | 12 |
| 6 | 1 | 2 | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 12 |
| 7 | 1 | 2 | 3 | 3 | 4 | 5 | 6 | 8 | 9 | 12 |
| 8 | 2 | 2 | 3 | 3 | 4 | 5 | 6 | 8 | 9 | 12 |
| 9 | 2 | 2 | 3 | 4 | 5 | 7 | 8 | 10 | 12 | 16 |
| 10 | 2 | 3 | 3 | 4 | 5 | 7 | 8 | 10 | 12 | 16 |
| 11 | 2 | 3 | 4 | 5 | 6 | 9 | 10 | 12 | 15 | 20 |
| 12 | 2 | 3 | 4 | 5 | 6 | 9 | 10 | 12 | 15 | 20 |

---

# Hit Location Table
| Die Roll (2D6) | Left Side | Front/Rear | Right Side |
| --- | --- | --- | --- |
| 2 | Floating Crit | Floating Crit | Floating Crit |
| 3 | Left Leg | Right Arm | Right Leg |
| 4 | Left Arm | Right Arm | Right Arm |
| 5 | Left Arm | Right Leg | Right Arm |
| 6 | Left Leg | Right Torso | Right Leg |
| 7 | Left Torso | C Torso | Right Torso |
| 8 | C Torso | Left Torso | C Torso |
| 9 | Right Torso | Left Leg | Left Torso |
| 10 | Right Arm | Left Arm | Left Arm |
| 11 | Right Leg | Left Arm | Left Leg |
| 12 | Head | Head | Head |

For "Floating Crit" results, roll again to deterimine the location of the crit and indicate that it is a crit in that location.