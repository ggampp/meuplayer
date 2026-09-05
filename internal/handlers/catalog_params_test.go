package handlers

import "testing"

func TestCatalogParameters(t *testing.T) {
	for _, raw := range []string{"0", "501", "-1", "abc"} {
		if _, err := catalogPage(raw); err == nil {
			t.Errorf("accepted page %q", raw)
		}
	}
	for _, raw := range []string{"NaN", "+Inf", "11", "-1", "7&x=y"} {
		if _, err := catalogRating(raw); err == nil {
			t.Errorf("accepted rating %q", raw)
		}
	}
	for _, raw := range []string{"1899", "2101", "2026&x=y"} {
		if _, err := catalogYear(raw); err == nil {
			t.Errorf("accepted year %q", raw)
		}
	}
	if n, err := catalogPage(""); err != nil || n != 1 {
		t.Fatal("default page")
	}
	if n, err := catalogRating("7.5"); err != nil || n != "7.5" {
		t.Fatal("valid rating")
	}
	if n, err := catalogYear("2026"); err != nil || n != "2026" {
		t.Fatal("valid year")
	}
}
