import unittest

from config import _parse_int_list


class ParseIntListTest(unittest.TestCase):
    def test_parses_comma_separated_ints(self):
        self.assertEqual(_parse_int_list("12, 34,56"), [12, 34, 56])

    def test_empty_or_none_yields_empty_list(self):
        self.assertEqual(_parse_int_list(None), [])
        self.assertEqual(_parse_int_list(""), [])

    def test_skips_non_integer_tokens(self):
        self.assertEqual(_parse_int_list("12,abc,34"), [12, 34])


if __name__ == "__main__":
    unittest.main()
